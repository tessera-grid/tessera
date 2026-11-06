// @vitest-environment happy-dom
/**
 * Охват страницы в серверной модели строк (ADR 0188; PA1–PA3, PA7–PA8): строки страницы по `id`,
 * весь итог без пагинации, срез «всё, кроме», ветки и группы, канал действий.
 * Запуск: npx vitest run --config vitest.node.config.ts serverPageSelection
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DebugAction } from '../core/debugActions'
import { readPluginHooks } from '../core/definePlugin'
import type { RowSource } from '../core/rowSource'
import {
  rowSelectionValueOf,
  setAllRowsSelected,
} from '../core/rowSelectionAll'
import { useCreateTable } from '../core/useCreateTable'
import { __resetLogger } from '../util/logger'
import {
  pagination,
  rowExpanding,
  rowGrouping,
  rowSelection,
  serverRowModel,
  type RowSelectionOptions,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import { HeadSelectionComponent } from '../plugins/rowSelection/HeadSelectionComponent'
import { selectionSummaryOf } from '../plugins/rowSelectionModel/selectionCount'
import {
  serverPageSelectionOf,
  toggleServerPage,
} from '../plugins/rowSelection/serverPageSelection'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  city?: string
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name' },
  { id: 'city', accessorKey: 'city' },
]
const NO_DATA: Item[] = []
const TOTAL = 100
const PAGE = 10

const container = document.createElement('div')
let root: Root
let table: any
let actions: DebugAction[]

const getRows = async ({
  start,
  end,
  parentId,
  grouping = [],
  groupKeys = [],
}: ServerRowsRequest): Promise<ServerRowsResponse<Item>> => {
  if (groupKeys.length < grouping.length) {
    return {
      rows: ['Paris', 'Rome'].map(city => ({ id: city, name: city, city })),
      rowCount: 2,
    }
  }
  const prefix = parentId ? `${parentId}.` : 'r'
  const count = parentId ? 3 : TOTAL
  return {
    rows: Array.from(
      { length: Math.max(0, Math.min(end, count) - start) },
      (_, i) => ({ id: `${prefix}${start + i}`, name: `N${start + i}` }),
    ),
    rowCount: count,
  }
}

const Grid = ({
  selection,
  extra = [],
  paged = true,
  head = false,
}: {
  selection?: RowSelectionOptions
  extra?: readonly unknown[]
  paged?: boolean
  head?: boolean
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    onDebugAction: (event: DebugAction) => actions.push(event),
    plugins: [
      serverRowModel({
        getRows,
        blockSize: PAGE,
        getGroupChildCount: row => (row.city === 'Paris' ? 3 : 4),
      }),
      ...(paged ? [pagination({ initialPageSize: PAGE })] : []),
      rowSelection({ selectAll: 'currentPage', ...selection }),
      ...extra,
    ] as never,
  })
  return head
    ? createElement(HeadSelectionComponent, {
        table,
        hooks: readPluginHooks(table, 'rowSelection'),
      } as never)
    : null
}

const render = (props: Parameters<typeof Grid>[0] = {}) =>
  act(() => root.render(createElement(Grid, props)))

const source = () => table.getRowSource() as RowSource<{ id: string }>
const show = (first = 0, last = PAGE - 1) =>
  act(async () => {
    source().observe!({ first, last, fast: false })
    await Promise.resolve()
  })
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 20)))
const page = (index: number) =>
  act(async () => {
    table.setPageIndex(index)
    await Promise.resolve()
  })
const ids = (from: number, to: number) =>
  Object.fromEntries(
    Array.from({ length: to - from }, (_, i) => [`r${from + i}`, true]),
  )

beforeEach(() => {
  actions = []
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
})

describe('охват страницы в SSRM (ADR 0188)', () => {
  it("PA1: SSRM с пагинацией, 'currentPage': флажок шапки выбирает строки верхнего уровня страницы по id, выбор других страниц не меняется, onSelectAllRows с 'currentPage'", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    __resetLogger()
    const onSelectAllRows = vi.fn()
    render({ selection: { onSelectAllRows } })
    const said = warn.mock.calls.flat().map(String)
    warn.mockRestore()
    expect(said.filter(line => line.includes('without pagination'))).toEqual([])
    await show()
    await settle()
    act(() => toggleServerPage(table, { onSelectAllRows }, 'pointer'))
    expect(rowSelectionValueOf(table)).toEqual(ids(0, PAGE))
    expect(onSelectAllRows).toHaveBeenCalledWith(true, 'currentPage')
    expect(serverPageSelectionOf(table).all).toBe(true)

    await page(1)
    await show()
    await settle()
    act(() => toggleServerPage(table, { onSelectAllRows }, 'pointer'))
    expect(rowSelectionValueOf(table)).toEqual(ids(0, PAGE * 2))

    act(() => toggleServerPage(table, { onSelectAllRows }, 'pointer'))
    expect(rowSelectionValueOf(table)).toEqual(ids(0, PAGE))
    expect(onSelectAllRows).toHaveBeenLastCalledWith(false, 'currentPage')
  })

  it("PA2: SSRM без пагинации — весь итог и dev-warn, с 'filtered' и 'all' — весь итог и при пагинации, без предупреждения", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const cases = [
        { selectAll: 'currentPage', paged: false, warned: true },
        { selectAll: 'filtered', paged: true, warned: false },
        { selectAll: 'all', paged: true, warned: false },
      ] as const
      for (const { selectAll, paged, warned } of cases) {
        warn.mockClear()
        __resetLogger()
        const onSelectAllRows = vi.fn()
        render({
          selection: { selectAll, onSelectAllRows },
          paged,
          head: true,
        })
        await show()
        await settle()
        act(() => {
          container
            .querySelector<HTMLElement>('[role="checkbox"]')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        expect(rowSelectionValueOf(table), selectAll).toEqual({
          all: true,
          except: [],
        })
        expect(onSelectAllRows, selectAll).toHaveBeenCalledWith(true, 'all')
        const said = warn.mock.calls.some(call =>
          call.some(part => String(part).includes('without pagination')),
        )
        expect(said, selectAll).toBe(warned)
        act(() => root.unmount())
        root = createRoot(container)
      }
    } finally {
      warn.mockRestore()
    }
  })

  it('PA3: срез «всё, кроме» — снятие добавляет строки страницы в исключения, выбор убирает их оттуда', async () => {
    render()
    await show()
    await settle()
    act(() => setAllRowsSelected(table, true))
    act(() => toggleServerPage(table, {}, 'pointer'))
    expect(rowSelectionValueOf(table)).toEqual({
      all: true,
      except: Object.keys(ids(0, PAGE)),
    })
    act(() => toggleServerPage(table, {}, 'pointer'))
    expect(rowSelectionValueOf(table)).toEqual({ all: true, except: [] })
  })

  it('PA7: ветка и группа на странице выбираются целиком; счётчик и объявление дают одно число', async () => {
    render({
      selection: { subRows: true },
      extra: [rowExpanding({ hasChildren: () => true })],
    })
    await show()
    await settle()
    act(() => toggleServerPage(table, {}, 'pointer'))
    const value = rowSelectionValueOf(table) as {
      branches?: { id: string; all: boolean }[]
    }
    expect(value.branches?.map(branch => branch.id).sort()).toEqual(
      Object.keys(ids(0, PAGE)).sort(),
    )
    expect(value.branches?.every(branch => branch.all)).toBe(true)

    act(() => root.unmount())
    root = createRoot(container)
    render({ extra: [rowGrouping({ initialGrouping: ['city'] })] })
    await show(0, 1)
    await settle()
    act(() => toggleServerPage(table, {}, 'pointer'))
    const grouped = rowSelectionValueOf(table) as {
      groups?: { keys: unknown[]; all: boolean }[]
    }
    expect(grouped.groups?.map(group => group.keys)).toEqual([
      ['Paris'],
      ['Rome'],
    ])
    expect(grouped.groups?.every(group => group.all)).toBe(true)
    // Счётчик и объявление читают одну сводку: строки обеих групп.
    expect(selectionSummaryOf(table, table.atoms.rowSelection.get())).toEqual({
      count: 7,
    })
  })

  it('PA8: канал действий — нажатие и итог загрузки', async () => {
    render()
    // Окна ещё нет: строки страницы приходят мимо кэша.
    await settle()
    act(() => toggleServerPage(table, {}, 'pointer'))
    await settle()
    const names = actions
      .filter(event => event.plugin === 'rowSelection')
      .map(event => event.action)
    expect(names).toEqual(['toggleAllPageRows', 'selectPageResolved'])
    expect(rowSelectionValueOf(table)).toEqual(ids(0, PAGE))
    expect(serverPageSelectionOf(table).all).toBe(true)
  })
})
