import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  pagination,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { rowSelectionLabels } from '../../../plugins/rowSelection/labels'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Охват страницы в серверной модели строк на гриде (ADR 0188): ожидание, отмена и смена страницы
// (PA4), отказ с плашкой (PA5), «выбран» и «частично» (PA6), доступность ожидания (PA9).

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const NO_DATA: Item[] = []
const TOTAL = 1000
const PAGE = 20
/** Блок меньше страницы: окно тела не загружает её целиком. */
const BLOCK = 5

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const head = () => q('.data-grid__head-cell .row-select-checkbox')
const rowBox = (id: string) =>
  q(`.data-grid__body-row[data-row-id="${id}"] .row-select-checkbox`)
const stateOf = (box: Element | null) =>
  box?.hasAttribute('data-checked')
    ? 'all'
    : box?.hasAttribute('data-indeterminate')
      ? 'some'
      : 'none'

const server = (hold: (request: ServerRowsRequest) => boolean) => {
  const held: { request: ServerRowsRequest; go: (fail?: Error) => void }[] = []
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
      const go = (fail?: Error) => {
        if (fail) return reject(fail)
        const { start, end } = request
        resolve({
          rows: Array.from({ length: end - start }, (_, i) => ({
            id: `r${start + i}`,
            name: `N${start + i}`,
          })),
          rowCount: TOTAL,
        })
      }
      if (hold(request)) held.push({ request, go })
      else go()
    })
  return { getRows, held }
}

const Grid = ({
  getRows,
  onTable,
}: {
  getRows: (request: ServerRowsRequest) => Promise<ServerRowsResponse<Item>>
  onTable?: (table: { setPageIndex: (index: number) => void }) => void
}) => {
  const table = useCreateTable({
    rowCount: TOTAL,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize: BLOCK, maxBlocks: 100 }),
      pagination({ initialPageSize: PAGE }),
      rowSelection({ selectAll: 'currentPage', selectedCount: true }),
    ] as never,
  })
  onTable?.(table as never)
  return (
    <div style={{ width: 500 }}>
      <DataGrid table={table} height={140} />
    </div>
  )
}

const selectedText = () =>
  q('[data-testid="selected-rows-count"]')?.textContent ?? ''

describe('охват страницы в SSRM на гриде (ADR 0188)', () => {
  test('PA4: страница загружена не вся — флажок ждёт, строки приходят через loadRange и выбираются; отмена, смена страницы и смена выборки выбор не меняют', async () => {
    let holding = false
    const { getRows, held } = server(() => holding)
    let table: { setPageIndex: (index: number) => void } | undefined
    const screen = await render(
      <Grid
        getRows={getRows}
        onTable={value => {
          table = value
        }}
      />,
    )
    try {
      await expect.poll(() => head()).not.toBeNull()
      await expect.poll(() => rowBox('r0')).not.toBeNull()
      holding = true

      // Ответ пришёл: выбрана вся страница, флажок — «выбран».
      await humanClick(head()!)
      await expect.poll(() => held.length).toBeGreaterThan(0)
      await expect.poll(() => head()!.getAttribute('aria-busy')).toBe('true')
      expect(selectedText()).toBe('')
      holding = false
      for (const { go } of held.splice(0)) go()
      await expect
        .poll(selectedText)
        .toBe(rowSelectionLabels(tableLabels).selectedRows(PAGE))
      await expect.poll(() => stateOf(head())).toBe('all')
      expect(head()!.getAttribute('aria-busy')).not.toBe('true')
      await humanClick(head()!)
      await expect.poll(selectedText).toBe('')

      // Отмена Escape: выбора нет, ожидание снято.
      table!.setPageIndex(1)
      await expect.poll(() => rowBox('r20')).not.toBeNull()
      holding = true
      await humanClick(head()!)
      await expect.poll(() => held.length).toBeGreaterThan(0)
      await userEvent.keyboard('{Escape}')
      await expect
        .poll(() => head()!.getAttribute('aria-busy'))
        .not.toBe('true')
      expect(selectedText()).toBe('')
      expect(held.every(({ request }) => request.signal.aborted)).toBe(true)
      held.length = 0

      // Смена страницы: ответ не выбирает строки прежней страницы.
      await humanClick(head()!)
      await expect.poll(() => held.length).toBeGreaterThan(0)
      table!.setPageIndex(2)
      await expect
        .poll(() => head()!.getAttribute('aria-busy'))
        .not.toBe('true')
      holding = false
      for (const { go } of held.splice(0)) go()
      await expect.poll(() => rowBox('r40')).not.toBeNull()
      expect(selectedText()).toBe('')
    } finally {
      await screen.unmount()
    }
  })

  test('PA5: отказ загрузки — плашка с причиной и повтором, выбор прежний', async () => {
    let holding = false
    const { getRows, held } = server(() => holding)
    const screen = await render(<Grid getRows={getRows} />)
    try {
      await expect.poll(() => rowBox('r0')).not.toBeNull()
      holding = true
      await humanClick(head()!)
      await expect.poll(() => held.length).toBeGreaterThan(0)
      held[0]!.go(new Error('Нет доступа'))
      await expect
        .poll(() => q('.data-grid__load-error')?.textContent ?? '')
        .toContain('Нет доступа')
      expect(selectedText()).toBe('')
      expect(head()!.getAttribute('aria-busy')).not.toBe('true')

      holding = false
      for (const { go } of held.splice(0)) go()
      await humanClick(q('[data-testid="load-error-retry"]')!)
      await expect
        .poll(selectedText)
        .toBe(rowSelectionLabels(tableLabels).selectedRows(PAGE))
    } finally {
      await screen.unmount()
    }
  })

  test('PA6: «выбран» и «частично» считаются по строкам страницы и пересчитываются при её смене', async () => {
    const { getRows } = server(() => false)
    let table: { setPageIndex: (index: number) => void } | undefined
    const screen = await render(
      <Grid
        getRows={getRows}
        onTable={value => {
          table = value
        }}
      />,
    )
    try {
      await expect.poll(() => rowBox('r0')).not.toBeNull()
      await humanClick(rowBox('r0')!)
      await expect.poll(() => stateOf(head())).toBe('some')
      await humanClick(head()!)
      await expect.poll(() => stateOf(head())).toBe('all')
      table!.setPageIndex(1)
      await expect.poll(() => rowBox('r20')).not.toBeNull()
      await expect.poll(() => stateOf(head())).toBe('none')
      table!.setPageIndex(0)
      await expect.poll(() => rowBox('r0')).not.toBeNull()
      await expect.poll(() => stateOf(head())).toBe('all')
    } finally {
      await screen.unmount()
    }
  })

  test('PA9: ожидание на флажке шапки — axe с color-contrast в обеих темах и вид в forced-colors', async () => {
    let holding = false
    const { getRows, held } = server(() => holding)
    const screen = await render(<Grid getRows={getRows} />)
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    try {
      await expect.poll(() => rowBox('r0')).not.toBeNull()
      holding = true
      await humanClick(head()!)
      await expect.poll(() => held.length).toBeGreaterThan(0)
      await inBothThemes(async () => {
        expect(
          (await axe.run(q('.data-grid-theme')!, options)).violations,
        ).toEqual([])
      })
      await fc.forcedColors(true)
      try {
        expect(
          (await axe.run(q('.data-grid-theme')!, options)).violations,
        ).toEqual([])
      } finally {
        await fc.forcedColors(false)
      }
      holding = false
      for (const { go } of held.splice(0)) go()
    } finally {
      await screen.unmount()
    }
  })
})
