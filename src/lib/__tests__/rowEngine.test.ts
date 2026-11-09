/**
 * Движок строк (ADR 0200, этап 1): слоты моделей TanStack — обёртки над стадиями движка
 * (EN27), стадия фильтра не копирует плоские строки (EN28).
 * Запуск: npx vitest run --config vitest.node.config.ts rowEngine
 */
import {
  constructTable,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  sortFn_alphanumeric,
} from '@tanstack/react-table'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { STAGES, stageOfSlot } from '../core/rowEngine/engine'
import {
  columnFilteringModel,
  columnSortingModel,
  paginationModel,
  quickSearchModel,
  rowExpandingModel,
  rowGroupingModel,
} from '../plugins'

interface Item {
  id: string
  name: string
  city: string
}

const item = (id: string, city: string): Item => ({
  id,
  name: `Name ${id}`,
  city,
})
const DATA: Item[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) =>
  item(id, ['Paris', 'Rome', 'Oslo'][i % 3]!),
)
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const REACTIVITY = {
  id: 'reactivity',
  features: { coreReactivityFeature: storeReactivityBindings() },
}

const build = (entries: readonly unknown[], extra: object = {}) => {
  const all = [REACTIVITY, ...entries]
  const folded = foldEntries(all as never)
  return constructTable({
    features: buildTesseraFeatures(all as never),
    data: DATA,
    columns: injectServiceColumns(COLUMNS as any[], folded.serviceColumns),
    getRowId: (row: Item) => row.id,
    ...folded.options,
    hooks: resolveHooks(foldHooks(all as never)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
    ...extra,
  } as never) as any
}

/** Та же таблица на стоковых моделях TanStack: эталон итога. */
const buildStock = (state: object) =>
  constructTable({
    features: {
      coreReactivityFeature: storeReactivityBindings(),
      ...(build([]).options.features as object),
      ...buildTesseraFeatures([
        REACTIVITY,
        columnSortingModel(),
        columnFilteringModel(),
        paginationModel({ initialPageSize: 3 }),
      ] as never),
      filteredRowModel: createFilteredRowModel(),
      sortedRowModel: createSortedRowModel(),
      paginatedRowModel: createPaginatedRowModel(),
      sortFns: { alphanumeric: sortFn_alphanumeric },
    },
    data: DATA,
    columns: COLUMNS,
    getRowId: (row: Item) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 3 }, ...state },
    logLevel: 'error',
  } as never) as any

const ids = (model: { rows: { id: string }[] }) => model.rows.map(row => row.id)

/** Исходники библиотеки без тестов и историй. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return ['__tests__', 'stories', '__mocks__'].includes(name)
        ? []
        : sources(path)
    }
    return /\.tsx?$/.test(name) ? [path] : []
  })

describe('Движок строк (ADR 0200)', () => {
  it('EN1: каркас движка в ядре, стадии приносят плагины моделей — каркас ничего не импортирует, обёртку стадии зовут только плагины моделей', () => {
    const root = join(__dirname, '..')
    const engine = readFileSync(join(root, 'core/rowEngine/engine.ts'), 'utf8')
    expect(engine).not.toMatch(/^import /m)
    const callers = sources(root)
      .filter(file => /\bstageSlot\b/.test(readFileSync(file, 'utf8')))
      .map(file => relative(root, file).replace(/\\/g, '/'))
      .filter(file => file !== 'core/rowEngine/engine.ts')
      .sort()
    expect(callers).toEqual([
      'plugins/columnFilteringModel/registry.ts',
      'plugins/columnSortingModel/registry.ts',
      'plugins/paginationModel/registry.ts',
      'plugins/quickSearchModel/registry.ts',
      'plugins/rowExpanding/registry.ts',
      'plugins/rowExpandingModel/registry.ts',
      'plugins/rowGroupingModel/registry.ts',
    ])
  })

  it('EN27: слоты моделей — обёртки над стадиями движка: стадию приносит плагин модели, порядок постоянный, manual* пропускает стадию, get*RowModel отдаёт выход стадии', () => {
    const plugins = [
      columnFilteringModel(),
      quickSearchModel(),
      rowGroupingModel(),
      columnSortingModel(),
      rowExpandingModel(),
      paginationModel({ initialPageSize: 3 }),
    ]
    const table = build(plugins)
    const features = table.options.features as Record<string, unknown>
    expect(STAGES.map(step => step.id)).toEqual([
      'filter',
      'group',
      'sort',
      'expand',
      'page',
    ])
    for (const step of STAGES) {
      expect(stageOfSlot(features[step.slot])?.id, step.slot).toBe(step.id)
    }
    expect(stageOfSlot(features.coreRowModel)).toBeUndefined()

    const state = {
      sorting: [{ id: 'city', desc: true }],
      columnFilters: [
        { id: 'city', value: { operator: 'contains', value: 'o' } },
      ],
    }
    table.setSorting(state.sorting)
    table.setColumnFilters(state.columnFilters)
    const stock = buildStock(state)
    expect(ids(table.getFilteredRowModel())).toEqual(
      ids(stock.getFilteredRowModel()),
    )
    expect(ids(table.getSortedRowModel())).toEqual(
      ids(stock.getSortedRowModel()),
    )
    expect(ids(table.getRowModel())).toEqual(ids(stock.getRowModel()))
    table.setPageIndex(1)
    stock.setPageIndex(1)
    expect(ids(table.getRowModel())).toEqual(ids(stock.getRowModel()))

    for (const [manual, getter, before] of [
      ['manualFiltering', 'getFilteredRowModel', 'getPreFilteredRowModel'],
      ['manualSorting', 'getSortedRowModel', 'getPreSortedRowModel'],
      ['manualPagination', 'getPaginatedRowModel', 'getPrePaginatedRowModel'],
    ] as const) {
      const skipped = build(plugins, { [manual]: true })
      skipped.setSorting(state.sorting)
      skipped.setColumnFilters(state.columnFilters)
      expect(skipped[getter](), manual).toBe(skipped[before]())
    }
  })

  it('EN28: стадия фильтра не копирует плоские строки — в полной сборке, при смене фильтра и при смене data строка отбора — строка модели ядра', () => {
    for (const plugin of [columnFilteringModel(), quickSearchModel()]) {
      const table = build([columnFilteringModel(), quickSearchModel(), plugin])
      const expectCore = (step: string) => {
        const core = table.getCoreRowModel().rowsById
        const { rows } = table.getFilteredRowModel()
        expect(rows.length, step).toBeGreaterThan(0)
        for (const row of rows)
          expect(row, `${step}: ${row.id}`).toBe(core[row.id])
      }
      table.setColumnFilters([
        { id: 'city', value: { operator: 'contains', value: 'o' } },
      ])
      expectCore('фильтр колонки')
      table.setGlobalFilter('Name')
      expectCore('поиск')
      table.setOptions((o: any) => ({
        ...o,
        data: [
          ...DATA.slice(0, 2),
          item('x', 'Oslo'),
          { ...DATA[2]!, city: 'Lyon' },
          ...DATA.slice(3),
        ],
      }))
      expectCore('вставка и замена в data')
      table.setOptions((o: any) => ({
        ...o,
        data: [...(o.data as Item[]), item('y', 'Rome')],
      }))
      expectCore('дописывание в data')
    }
  })
})
