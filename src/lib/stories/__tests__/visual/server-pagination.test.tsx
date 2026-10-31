import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import type { TesseraFeatureEntry } from '../../../core/features'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnFilteringModel,
  columnSortingModel,
  pagination,
  quickSearchModel,
  rowExpanding,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS } from './a11y-helpers'

// Пагинация в серверной модели строк на гриде (ADR 0158): переход и кэш страниц (SP2),
// неизвестный итог (SP4), первая страница при смене выборки и размера (SP5), черновик
// правки (SP6), прокрутка к строке другой страницы (SP7), клавиши и `aria-*` (SP8).

interface Item {
  id: string
  name: string
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
]
const NO_DATA: Item[] = []
const PAGE = 25

interface Call {
  request: ServerRowsRequest
  settle: (answer: ServerRowsResponse<Item> | Error) => void
}

/** «Сервер» отдаёт строки по запросу теста или сразу, если тест не держит ответы. */
const server = ({
  total = 1000,
  knownTotal = true,
  hold = () => false,
}: {
  total?: number
  knownTotal?: boolean
  hold?: (request: ServerRowsRequest) => boolean
} = {}) => {
  const calls: Call[] = []
  const answerFor = ({
    start,
    end,
    parentId,
  }: ServerRowsRequest): ServerRowsResponse<Item> => {
    const count = parentId ? 3 : total
    const prefix = parentId ? `${parentId}.` : 'r'
    return {
      rows: Array.from(
        { length: Math.max(0, Math.min(end, count) - start) },
        (_, k) => ({ id: `${prefix}${start + k}`, name: `N${start + k}` }),
      ),
      ...(knownTotal || parentId ? { rowCount: count } : {}),
    }
  }
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
      const settle = (answer: ServerRowsResponse<Item> | Error) =>
        answer instanceof Error ? reject(answer) : resolve(answer)
      calls.push({ request, settle })
      if (!hold(request)) settle(answerFor(request))
    })
  /** Ответить на удержанные запросы блока `start`. */
  const reply = (start: number, answer?: Error) =>
    calls
      .filter(
        call => call.request.start === start && !call.request.signal.aborted,
      )
      .forEach(call => call.settle(answer ?? answerFor(call.request)))
  const starts = () => calls.map(call => call.request.start)
  return { calls, getRows, reply, starts }
}

interface PagedTable {
  setSorting: (sorting: { id: string; desc: boolean }[]) => void
  setColumnFilters: (filters: { id: string; value: unknown }[]) => void
  setGlobalFilter: (value: string) => void
  setPageIndex: (index: number) => void
  scrollToRow: (id: string, options?: { index?: number }) => Promise<boolean>
  scrollToRowIndex: (index: number) => Promise<boolean>
}

const Grid = ({
  getRows,
  rowCount,
  pageSize = PAGE,
  blockSize = 100,
  maxBlocks,
  plugins = [],
  keyboard,
  onTable,
}: {
  getRows: (request: ServerRowsRequest) => Promise<ServerRowsResponse<Item>>
  rowCount?: number
  pageSize?: number
  blockSize?: number
  maxBlocks?: number
  plugins?: readonly TesseraFeatureEntry[]
  /** Клавиатурная навигация (ADR 0170, §1). */
  keyboard?: boolean
  onTable?: (table: PagedTable) => void
}) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    rowCount,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize, maxBlocks }),
      pagination({ initialPageSize: pageSize }),
      ...plugins,
    ] as never,
  })
  onTable?.(table as unknown as PagedTable)
  return (
    <div style={{ width: 400, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const range = () => q('[data-testid="pagination-range"]')?.textContent
const pageButton = (action: 'first' | 'previous' | 'next' | 'last') =>
  q<HTMLButtonElement>(`[data-page-action="${action}"]`)!
/** Кнопка погашена: подсказка у неё остаётся, поэтому `aria-disabled`. */
const off = (action: 'first' | 'previous' | 'next' | 'last') =>
  pageButton(action).getAttribute('aria-disabled') === 'true'
const rowById = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
const dataRows = () =>
  document.querySelectorAll('.data-grid__body-row[data-row-id]').length
const skeletons = () => document.querySelectorAll('[data-pending-row]').length
const sizeTrigger = () => q('[data-testid="page-size-select"]')
const focusedIndex = () =>
  Number(
    (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
      '[data-index]',
    )?.dataset.index ?? -1,
  )

describe('пагинация в серверной модели строк (ADR 0158)', () => {
  test('SP2: переход на незагруженную страницу — сразу, строки скелетами; отказ блока — строки ошибки с повтором; посещённая страница — из кэша без запроса', async () => {
    // Первый запрос последнего блока ждёт теста, повтор отвечает сразу.
    let held = false
    const { getRows, reply, starts } = server({
      hold: request => request.start === 900 && !held && (held = true),
    })
    const screen = await render(<Grid getRows={getRows} rowCount={1000} />)
    try {
      await expect.poll(() => rowById('r0')).not.toBeNull()
      await userEvent.click(pageButton('last'))
      // Страница — сразу, ответ ещё в пути: на месте строк скелеты.
      expect(range()).toBe(tableLabels.pageRange(976, 1000, 1000))
      await expect.poll(skeletons).toBeGreaterThan(0)
      expect(dataRows()).toBe(0)
      expect(starts()).toContain(900)

      reply(900, new Error('Server error'))
      const failure = await vi.waitFor(() => {
        const row = q('[data-testid="rows-load-error"]')
        if (!row) throw new Error('error row not rendered')
        return row
      })
      await userEvent.click(failure.querySelector('button')!)
      await expect.poll(() => rowById('r975')).not.toBeNull()

      const requested = starts().length
      await userEvent.click(pageButton('first'))
      await expect.poll(() => rowById('r0')).not.toBeNull()
      expect(skeletons()).toBe(0)
      expect(starts().length).toBe(requested)
    } finally {
      await screen.unmount()
    }
  })

  test('SP4: неизвестный итог — «1–N из многих», кнопка последней страницы недоступна до короткого блока, после него — итог и кнопка доступна', async () => {
    const { getRows } = server({ total: 230, knownTotal: false })
    const screen = await render(
      <Grid getRows={getRows} pageSize={50} blockSize={100} />,
    )
    try {
      await expect.poll(() => rowById('r0')).not.toBeNull()
      expect(range()).toBe(tableLabels.pageRangeOfMany(1, 50))
      expect(off('last')).toBe(true)
      expect(off('next')).toBe(false)
      // Вперёд, пока не придёт короткий блок.
      for (const first of [50, 100, 150, 200]) {
        await userEvent.click(pageButton('next'))
        await expect.poll(() => rowById(`r${first}`)).not.toBeNull()
      }
      await expect.poll(range).toBe(tableLabels.pageRange(201, 230, 230))
      expect(off('next')).toBe(true)
      await userEvent.click(pageButton('first'))
      await expect.poll(range).toBe(tableLabels.pageRange(1, 50, 230))
      expect(off('last')).toBe(false)
      await userEvent.click(pageButton('last'))
      await expect.poll(() => rowById('r200')).not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('SP5: смена сортировки, фильтра, поиска или размера страницы — первая страница', async () => {
    const { getRows } = server()
    let table!: PagedTable
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        plugins={[
          columnSortingModel(),
          columnFilteringModel(),
          quickSearchModel(),
        ]}
        onTable={value => (table = value)}
      />,
    )
    const thirdPage = async () => {
      await userEvent.click(pageButton('next'))
      await userEvent.click(pageButton('next'))
      await expect.poll(range).toBe(tableLabels.pageRange(51, 75, 1000))
    }
    const firstPage = () =>
      expect.poll(range).toBe(tableLabels.pageRange(1, PAGE, 1000))
    try {
      await expect.poll(() => rowById('r0')).not.toBeNull()
      await thirdPage()
      table.setSorting([{ id: 'name', desc: true }])
      await firstPage()
      await thirdPage()
      table.setColumnFilters([
        { id: 'name', value: { operator: 'contains', value: 'N' } },
      ])
      await firstPage()
      await thirdPage()
      table.setGlobalFilter('N')
      await firstPage()

      // Размер — выбором в пейджере.
      await thirdPage()
      await expect.poll(sizeTrigger).not.toBeNull()
      await userEvent.click(sizeTrigger()!)
      const option = await vi.waitFor(() => {
        const item = [
          ...document.querySelectorAll<HTMLElement>('[role="option"]'),
        ].find(node => node.textContent?.trim() === '50')
        if (!item) throw new Error('option 50 not rendered')
        return item
      })
      await userEvent.click(option)
      await expect.poll(range).toBe(tableLabels.pageRange(1, 50, 1000))
    } finally {
      await screen.unmount()
    }
  })

  test('SP6: черновик правки переживает смену страницы приложением и возврат, пока блок в кэше; блок строки в правке не вытесняется', async () => {
    const { getRows, starts } = server()
    let table!: PagedTable
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        blockSize={PAGE}
        maxBlocks={2}
        plugins={[cellEditing({ canEditCell: () => true })]}
        onTable={value => (table = value)}
      />,
    )
    const cell = () =>
      q('.data-grid__body-row[data-row-id="r1"] [data-column-id="name"]')
    const draft = () => cell()?.querySelector<HTMLInputElement>('input')
    try {
      await expect.poll(cell).not.toBeNull()
      await userEvent.hover(cell()!)
      await humanClick(
        cell()!.querySelector<HTMLElement>('.cell__button button')!,
      )
      await expect.poll(draft).not.toBeNull()
      await userEvent.clear(draft()!)
      await userEvent.type(draft()!, 'Draft')

      // Приложение показывает строки трёх других страниц: блоков в кэше — два.
      for (const id of ['r30', 'r60', 'r90']) {
        await table.scrollToRow(id, { index: Number(id.slice(1)) })
        await expect.poll(() => rowById(id)).not.toBeNull()
      }
      expect(draft()).toBeFalsy()
      await table.scrollToRow('r1')
      await expect.poll(() => draft()?.value).toBe('Draft')
      // Блок строки в правке не уходил из кэша: его не просили снова.
      expect(starts().filter(start => start === 0)).toHaveLength(1)
    } finally {
      await screen.unmount()
    }
  })

  test('SP7: scrollToRow и scrollToRowIndex к строке другой страницы переходят на неё', async () => {
    const { getRows } = server()
    let table!: PagedTable
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        onTable={value => (table = value)}
      />,
    )
    try {
      await expect.poll(() => rowById('r0')).not.toBeNull()
      // Строка загружена, но на четвёртой странице.
      await expect(table.scrollToRow('r80')).resolves.toBe(true)
      expect(range()).toBe(tableLabels.pageRange(76, 100, 1000))
      expect(rowById('r80')).not.toBeNull()
      // Строка не загружена: сквозной индекс — страница 21.
      await expect(table.scrollToRowIndex(520)).resolves.toBe(true)
      expect(range()).toBe(tableLabels.pageRange(501, 525, 1000))
      await expect.poll(() => rowById('r520')).not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('SP8: клавиши ходят в пределах страницы; aria-rowindex сквозной, aria-rowcount — итог; axe в ролях grid и treegrid', async () => {
    for (const plugins of [[], [rowExpanding({ hasChildren: () => true })]]) {
      const role = plugins.length > 0 ? 'treegrid' : 'grid'
      const { getRows } = server()
      const screen = await render(
        <Grid getRows={getRows} rowCount={1000} keyboard plugins={plugins} />,
      )
      try {
        await expect.poll(() => rowById('r0')).not.toBeNull()
        await userEvent.click(pageButton('next'))
        await expect.poll(() => rowById('r25')).not.toBeNull()
        const grid = q(`[role="${role}"]`)!
        expect(grid.getAttribute('aria-rowcount')).toBe('1001')
        expect(rowById('r25')!.getAttribute('aria-rowindex')).toBe('27')

        const first = rowById('r25')!.querySelector<HTMLElement>(
          '[data-kn-cell][data-column-id="name"]',
        )!
        await humanClick(first)
        await expect.poll(() => document.activeElement).toBe(first)
        // Конец списка для клавиш — последняя строка страницы.
        await userEvent.keyboard('{Control>}{End}{/Control}')
        await expect.poll(focusedIndex).toBe(PAGE - 1)
        await expect
          .poll(() => rowById('r49')?.contains(document.activeElement))
          .toBe(true)
        await userEvent.keyboard('{ArrowDown}')
        await expect.poll(focusedIndex).toBe(PAGE - 1)
        expect(range()).toBe(tableLabels.pageRange(26, 50, 1000))

        const { violations } = await axe.run(q('.data-grid-theme')!, {
          ...AXE_OPTIONS,
          rules: {
            ...AXE_OPTIONS.rules,
            'color-contrast': { enabled: true },
          },
        })
        expect(violations, role).toEqual([])
      } finally {
        await screen.unmount()
      }
    }
  })
})
