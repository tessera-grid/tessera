/**
 * Холостые проходы фильтрации и группировки (ADR 0068; PT1–PT6): без фильтров и
 * группировки второй проход подряд отдаёт модель на входе, первый после снятия —
 * обычный TanStack; конвейер совпадает с конвейером на фабриках TanStack.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import {
  constructTable,
  createFilteredRowModel,
  createGroupedRowModel,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import {
  columnFiltering,
  pagination,
  quickSearch,
  rowExpanding,
  rowGrouping,
} from '../plugins'
import { setLoadedAnswer } from '../plugins/rowExpanding/lazyChildrenFeature'

interface Item {
  id: string
  name: string
  city: string
  kids?: boolean
}

const item = (id: string, city: string, kids = false): Item => ({
  id,
  name: `Name ${id}`,
  city,
  kids,
})
const DATA: Item[] = [
  item('a', 'Paris', true),
  item('b', 'Rome'),
  item('c', 'Paris', true),
  item('d', 'Oslo'),
  item('e', 'Rome'),
  item('f', 'Oslo'),
]
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'city', accessorKey: 'city', header: 'City', filter: 'text' },
]
const kids = (parent: string, tag: string) =>
  [1, 2].map(i => item(`${parent}-${tag}${i}`, 'Lima'))
/** Ответ `loadChildren` строки, как его записывает раскрытие. */
const answer = (table: any, rowId: string, tag: string) =>
  setLoadedAnswer(table, prev => ({ ...prev, [rowId]: kids(rowId, tag) }))

type Entry = { features?: Record<string, unknown> }
/** Те же плагины на фабриках моделей TanStack. */
const withStockModels = (entry: Entry): Entry =>
  entry.features &&
  ('filteredRowModel' in entry.features || 'groupedRowModel' in entry.features)
    ? {
        ...entry,
        features: {
          ...entry.features,
          ...('filteredRowModel' in entry.features
            ? { filteredRowModel: createFilteredRowModel() }
            : {}),
          ...('groupedRowModel' in entry.features
            ? { groupedRowModel: createGroupedRowModel() }
            : {}),
        },
      }
    : entry

const plugins = (): Entry[] => [
  columnFiltering(),
  quickSearch(),
  rowGrouping(),
  rowExpanding({
    hasChildren: (row: { original: Item }) => !!row.original.kids,
    loadChildren: () => [],
  }),
  pagination({ initialPageSize: 100 }),
]

const build = ({
  stock = false,
  options = {},
}: { stock?: boolean; options?: Record<string, unknown> } = {}) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...plugins().map(entry => (stock ? withStockModels(entry) : entry)),
  ]
  const folded = foldEntries(entries as never)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data: DATA,
    columns: injectServiceColumns(COLUMNS as any[], folded.serviceColumns),
    getRowId: (row: Item) => row.id,
    ...folded.options,
    ...options,
    hooks: resolveHooks(foldHooks(entries as never)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
  } as never) as any
}

const nameFilter = (value: string) => [
  { id: 'name', value: { operator: 'contains', value } },
]

describe('Холостые проходы фильтрации и группировки (ADR 0068)', () => {
  it('PT1: без фильтров и поиска второй холостой проход — та же модель, словари фильтров строк прежние', () => {
    const table = build()
    table.getFilteredRowModel()
    const filters = table.getCoreRowModel().rowsById.b.columnFilters
    answer(table, 'a', 'x')
    const model = table.getFilteredRowModel()
    expect(model).toBe(table.getPreFilteredRowModel())
    expect(model.rowsById['a-x1']).toBeDefined()
    expect(model.rowsById.b.columnFilters).toBe(filters)
  })

  it('PT2: первый проход после снятия фильтра колонки или поиска очищает словари фильтров строк', () => {
    const table = build()
    table.getFilteredRowModel()
    table.setColumnFilters(nameFilter('Name a'))
    expect(table.getFilteredRowModel().rows.map((r: any) => r.id)).toEqual([
      'a',
    ])
    expect(table.getCoreRowModel().rowsById.b.columnFilters.name).toBe(false)
    table.setColumnFilters([])
    table.getFilteredRowModel()
    expect({ ...table.getCoreRowModel().rowsById.b.columnFilters }).toEqual({})

    table.setGlobalFilter('Name b')
    expect(table.getFilteredRowModel().rows.map((r: any) => r.id)).toEqual([
      'b',
    ])
    expect(
      Object.keys(table.getCoreRowModel().rowsById.a.columnFilters),
    ).not.toEqual([])
    table.setGlobalFilter('')
    table.getFilteredRowModel()
    expect({ ...table.getCoreRowModel().rowsById.a.columnFilters }).toEqual({})
  })

  it('PT3: без группировки второй холостой проход — та же модель, depth/parentId строк не переписываются', () => {
    const table = build()
    table.getGroupedRowModel()
    const row = table.getCoreRowModel().rowsById.b
    let writes = 0
    for (const key of ['depth', 'parentId']) {
      let value = row[key]
      Object.defineProperty(row, key, {
        configurable: true,
        get: () => value,
        set: next => {
          writes++
          value = next
        },
      })
    }
    answer(table, 'a', 'x')
    const model = table.getGroupedRowModel()
    expect(model).toBe(table.getPreGroupedRowModel())
    expect(model.rowsById.b).toBe(row)
    expect(writes).toBe(0)
  })

  it('PT4: первый проход после снятия группировки восстанавливает depth/parentId строк', () => {
    const table = build()
    table.getGroupedRowModel()
    table.setGrouping(['city'])
    table.getGroupedRowModel()
    const row = table.getCoreRowModel().rowsById.b
    expect([row.depth, row.parentId]).toEqual([1, 'city:Rome'])
    table.setGrouping([])
    table.getGroupedRowModel()
    expect([row.depth, row.parentId]).toEqual([0, undefined])
  })

  it('PT5: конвейер совпадает с фабриками TanStack на ответах, смене data, фильтре, поиске и группировке', () => {
    const ours = build()
    const stock = build({ stock: true })
    const shape = (table: any) => ({
      rows: table.getRowModel().rows.map((row: any) => ({
        id: row.id,
        depth: row.depth,
        parentId: row.parentId,
        subRows: row.subRows.map((child: any) => child.id),
        columnFilters: { ...row.columnFilters },
      })),
      flat: table
        .getPreSortedRowModel()
        .flatRows.map((row: any) => [
          row.id,
          row.depth,
          row.parentId,
          { ...row.columnFilters },
        ]),
    })
    const steps: [string, (table: any) => void][] = [
      ['начало', () => {}],
      ['раскрыть всё', t => t.setExpanded(true)],
      ['ответ a', t => answer(t, 'a', 'x')],
      [
        'смена data',
        t => t.setOptions((o: any) => ({ ...o, data: [...DATA] })),
      ],
      ['ответ c', t => answer(t, 'c', 'x')],
      ['фильтр', t => t.setColumnFilters(nameFilter('Name a'))],
      ['без фильтра', t => t.setColumnFilters([])],
      ['ответ a заменён', t => answer(t, 'a', 'y')],
      ['поиск', t => t.setGlobalFilter('Name c')],
      ['без поиска', t => t.setGlobalFilter('')],
      ['группировка', t => t.setGrouping(['city'])],
      ['без группировки', t => t.setGrouping([])],
      ['ответ c удалён', t => t.resetLoadedChildren('c')],
      [
        'смена data снова',
        t => t.setOptions((o: any) => ({ ...o, data: [...DATA] })),
      ],
    ]
    for (const [step, apply] of steps) {
      apply(ours)
      apply(stock)
      expect(shape(ours), step).toEqual(shape(stock))
    }
  })

  it('PT6: холостой путь сбрасывает страницу и раскрытие при смене модели на входе, когда автосбросы включены', async () => {
    const options = { autoResetPageIndex: true, autoResetExpanded: true }
    // Автосбросы TanStack — микрозадачи после пересчёта; в гриде между шагами — рендер.
    const step = async (table: any, act: () => void) => {
      act()
      table.getRowModel()
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    const run = async (table: any) => {
      await step(table, () => table.setPageSize(2))
      await step(table, () => answer(table, 'a', 'x'))
      await step(table, () => {
        table.setPageIndex(1)
        table.setExpanded({ a: true })
      })
      await step(table, () => answer(table, 'a', 'y'))
      return {
        pageIndex: table.atoms.pagination.get().pageIndex,
        expanded: table.atoms.expanded.get(),
      }
    }
    const stock = await run(build({ stock: true, options }))
    expect(stock).toEqual({ pageIndex: 0, expanded: {} })
    expect(await run(build({ options }))).toEqual(stock)
  })
})
