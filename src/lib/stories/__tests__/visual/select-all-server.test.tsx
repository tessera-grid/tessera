/**
 * «Выбрать всё», где строк нет у грида (ADR 0179, SE6–SE7, SE14–SE15): страница с сервера и
 * лента — срез «всё, кроме» без загрузки строк; объявление и счётчик — одно число во всех
 * режимах и охватах; флажок шапки в трёх состояниях — axe и `forced-colors`.
 */
import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, server as browser } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import type { DataMode } from '../../../core/dataMode'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  infiniteScroll,
  pagination,
  rowSelection,
  type SelectAllScope,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { rowSelectionLabels } from '../../../plugins/rowSelection/labels'
import { rowSelectionModelLabels } from '../../../plugins/rowSelectionModel/labels'

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const itemsOf = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, name: `Name ${i}` }))

type Mode = 'client' | 'page' | 'feed'

interface GridProps {
  mode: Mode
  /** Строк в `data`: у страницы с сервера и ленты — загруженные. */
  rows?: number
  /** Итог на сервере; `-1` — неизвестен. */
  rowCount?: number
  scope?: SelectAllScope
  /** Клиентская пагинация по `pageSize` строк. */
  pageSize?: number
  changes?: unknown[]
}

const NO_DATA = new Map<number, Item[]>()
const dataOf = (count: number) => {
  let data = NO_DATA.get(count)
  if (!data) NO_DATA.set(count, (data = itemsOf(count)))
  return data
}
const SERVER_PAGE: DataMode = { pagination: 'server' }
const onLoadMore = () => new Promise<void>(() => {})

const Grid = ({
  mode,
  rows = 5,
  rowCount,
  scope,
  pageSize,
  changes,
}: GridProps) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: dataOf(rows),
    getRowId: (row: Item) => row.id,
    dataMode: mode === 'page' ? SERVER_PAGE : undefined,
    rowCount,
    plugins: [
      ...(mode === 'page' || pageSize
        ? [pagination({ initialPageSize: pageSize ?? rows })]
        : []),
      ...(mode === 'feed'
        ? [infiniteScroll({ onLoadMore, hasMore: true })]
        : []),
      rowSelection({
        selectAll: scope,
        selectedCount: true,
        onRowSelectionChange: next => changes?.push(next),
      }),
    ] as never,
  })
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const head = () => q('.data-grid__head-cell [role="checkbox"]')!
const headState = () => head().getAttribute('aria-checked')
const rowCheckbox = (id: string) =>
  q(`.data-grid__body-row[data-row-id="${id}"] [role="checkbox"]`)!
const checkedRows = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row [role="checkbox"]',
    ),
  ].filter(box => box.getAttribute('aria-checked') === 'true').length
const bodyRows = () => document.querySelectorAll('.data-grid__body-row').length
const count = () =>
  q('[data-testid="selected-rows-count"]')?.textContent?.trim() ?? ''
const live = () =>
  q('[role="status"][aria-live="polite"]')?.textContent?.trim() ?? ''

const mount = async (props: GridProps) => {
  const screen = await render(<Grid {...props} />)
  await expect.poll(() => q('.data-grid__body-row')).not.toBeNull()
  return screen
}

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}
const systemColor = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

describe('«Выбрать всё» без строк у грида (ADR 0179)', () => {
  test('SE6: страница с сервера — флажок шапки ставит «всё, кроме» без загрузки строк; флажки строк живые, снятый — исключение; счётчик — итог минус исключения, итог неизвестен — «все, кроме k»', async () => {
    const changes: unknown[] = []
    const known = await mount({ mode: 'page', rowCount: 100, changes })
    await humanClick(head())
    await expect.poll(() => changes.at(-1)).toEqual({ all: true, except: [] })
    await expect.poll(checkedRows).toBe(5)
    expect(bodyRows()).toBe(5)
    await expect
      .poll(count)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(100))

    await humanClick(rowCheckbox('r2'))
    await expect
      .poll(() => changes.at(-1))
      .toEqual({ all: true, except: ['r2'] })
    await expect
      .poll(count)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(99))
    expect(headState()).toBe('mixed')
    expect(checkedRows()).toBe(4)
    await known.unmount()

    const unknown = await mount({ mode: 'page', rowCount: -1 })
    await humanClick(head())
    await expect.poll(checkedRows).toBe(5)
    await humanClick(rowCheckbox('r1'))
    await expect
      .poll(count)
      .toBe(rowSelectionModelLabels(tableLabels).selectedAllExcept(1))
    await unknown.unmount()
  })

  test('SE7: лента — флажок шапки ставит «всё, кроме» поверх загруженных строк; счётчик — итог ленты минус исключения', async () => {
    const changes: unknown[] = []
    const screen = await mount({ mode: 'feed', rowCount: 100, changes })
    await humanClick(head())
    await expect.poll(() => changes.at(-1)).toEqual({ all: true, except: [] })
    await expect.poll(checkedRows).toBe(5)
    await expect
      .poll(count)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(100))

    await humanClick(rowCheckbox('r0'))
    await expect
      .poll(() => changes.at(-1))
      .toEqual({ all: true, except: ['r0'] })
    await expect
      .poll(count)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(99))
    await screen.unmount()
  })

  test('SE14: объявление выбора и счётчик — одно число во всех режимах и охватах', async () => {
    const cases: [string, GridProps, number][] = [
      ['клиент, filtered', { mode: 'client', rows: 10 }, 10],
      [
        'клиент, currentPage',
        { mode: 'client', rows: 10, pageSize: 5, scope: 'currentPage' },
        5,
      ],
      ['клиент, all', { mode: 'client', rows: 10, scope: 'all' }, 10],
      ['страница с сервера', { mode: 'page', rowCount: 100 }, 100],
      ['лента', { mode: 'feed', rowCount: 100 }, 100],
    ]
    for (const [label, props, selected] of cases) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await mount(props)
      // eslint-disable-next-line no-await-in-loop
      await humanClick(head())
      // eslint-disable-next-line no-await-in-loop
      await expect
        .poll(count, { message: label })
        .toBe(rowSelectionLabels(tableLabels).selectedRows(selected))
      // eslint-disable-next-line no-await-in-loop
      await expect
        .poll(live, { message: label })
        .toBe(rowSelectionModelLabels(tableLabels).announceSelection(selected))
      // eslint-disable-next-line no-await-in-loop
      await screen.unmount()
    }
  })

  test('SE15: флажок шапки — axe с color-contrast в обеих темах и вид в forced-colors в трёх состояниях при каждом охвате', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const check = async (label: string) => {
      await inBothThemes(async () => {
        expect(
          (await axe.run(q('.data-grid-theme')!, options)).violations,
          label,
        ).toEqual([])
      })
      if (browser.browser === 'webkit') return
      await fc.forcedColors(true)
      try {
        if (headState() !== 'false') {
          // Отмеченный и частичный флажок залиты системным цветом выбора.
          expect(getComputedStyle(head()).backgroundColor, label).toBe(
            systemColor('Highlight'),
          )
        }
        expect(
          (await axe.run(q('.data-grid-theme')!, options)).violations,
          label,
        ).toEqual([])
      } finally {
        await fc.forcedColors(false)
      }
    }
    const cases: [string, GridProps][] = [
      ['filtered', { mode: 'client', rows: 5 }],
      [
        'currentPage',
        { mode: 'client', rows: 10, pageSize: 5, scope: 'currentPage' },
      ],
      ['all', { mode: 'client', rows: 5, scope: 'all' }],
      ['всё, кроме', { mode: 'page', rowCount: 100 }],
    ]
    for (const [label, props] of cases) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await mount(props)
      // eslint-disable-next-line no-await-in-loop
      await check(`${label}: не отмечен`)
      // eslint-disable-next-line no-await-in-loop
      await humanClick(rowCheckbox('r0'))
      // eslint-disable-next-line no-await-in-loop
      await expect.poll(headState).toBe('mixed')
      // eslint-disable-next-line no-await-in-loop
      await check(`${label}: частично`)
      // eslint-disable-next-line no-await-in-loop
      await humanClick(head())
      // eslint-disable-next-line no-await-in-loop
      await expect.poll(headState).toBe('true')
      // eslint-disable-next-line no-await-in-loop
      await check(`${label}: отмечен`)
      // eslint-disable-next-line no-await-in-loop
      await screen.unmount()
    }
  })
})
