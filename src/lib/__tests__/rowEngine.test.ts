/**
 * Движок строк (ADR 0200, этап 1): слоты моделей TanStack — обёртки над стадиями движка
 * (EN27), стадия фильтра не копирует плоские строки (EN28).
 * Запуск: npx vitest run --config vitest.node.config.ts rowEngine
 */
import {
  constructTable,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  sortFn_alphanumeric,
} from '@tanstack/react-table'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { types } from 'node:util'

import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { childrenOf } from '../core/rowEngine/displayChildren'
import { STAGES, engineOf, stageOfSlot } from '../core/rowEngine/engine'
import { positionOf } from '../core/rowPosition'
import { rowSourceOf } from '../core/rowSource'
import {
  columnFiltering,
  columnFilteringModel,
  columnSorting,
  columnSortingModel,
  pagination,
  paginationModel,
  quickSearch,
  quickSearchModel,
  rowExpanding,
  rowExpandingModel,
  rowGrouping,
  rowGroupingModel,
  rowSelection,
  serverRowModel,
} from '../plugins'
import { setLoadedAnswer } from '../plugins/rowExpanding/lazyChildrenFeature'

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
  it('EN1: каркас движка в ядре, стадии приносят плагины моделей — каркас не импортирует плагины, shared/, грид и кит, обёртку стадии зовут только плагины моделей', () => {
    const root = join(__dirname, '..')
    for (const name of readdirSync(join(root, 'core/rowEngine'))) {
      const text = readFileSync(join(root, 'core/rowEngine', name), 'utf8')
      expect(text, name).not.toMatch(
        /from '(?:\.\.\/)+(?:plugins|shared|grid|ui)\//,
      )
    }
    const callers = sources(root)
      .filter(file => /\bownStage\b/.test(readFileSync(file, 'utf8')))
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

describe('Место строки (ADR 0200, §5)', () => {
  it('EN5: место строки знает хранилище — после вставки в середину сдвинутая строка прежним объектом с прежним index, positionOf — новое место, accessorFn получает индекс при создании, равные при сортировке — по месту, как у полной сборки', () => {
    const columns = [
      ...COLUMNS,
      { id: 'pos', accessorFn: (_row: Item, index: number) => index },
    ]
    const sorted = (extra: object) =>
      build([columnSortingModel()], { columns, ...extra })
    const table = sorted({})
    const shifted = table.getCoreRowModel().rowsById.e
    expect(shifted.getValue('pos')).toBe(4)
    const next = [...DATA.slice(0, 2), item('x', 'Rome'), ...DATA.slice(2)]
    table.setOptions((o: any) => ({ ...o, data: next }))
    const core = table.getCoreRowModel()
    expect(core.rowsById.e).toBe(shifted)
    expect(shifted.index).toBe(4)
    expect(positionOf(shifted)).toBe(5)
    expect(core.rows.map((row: any) => positionOf(row))).toEqual(
      core.rows.map((_: unknown, i: number) => i),
    )
    expect(shifted.getValue('pos')).toBe(4)

    table.setSorting([{ id: 'city', desc: false }])
    const fresh = sorted({ data: next })
    fresh.setSorting([{ id: 'city', desc: false }])
    expect(ids(table.getRowModel())).toEqual(ids(fresh.getRowModel()))
  })
})

describe('Хранилище строк (ADR 0200, этап 3)', () => {
  it('EN4: строка создаётся один раз на объект данных — прежний объект в новом data остаётся прежней строкой, новый объект — новая строка', () => {
    const table = build([])
    // Прежняя модель — словарь своей версии (ADR 0200, §6): держим модель, а не её словарь.
    const model = table.getCoreRowModel()
    const next = DATA.map((row, i) =>
      i === 2 ? { ...row, city: 'Lyon' } : row,
    )
    table.setOptions((o: any) => ({ ...o, data: next }))
    const after = table.getCoreRowModel().rowsById
    for (const row of DATA) {
      if (row.id === 'c') expect(after.c).not.toBe(model.rowsById.c)
      else expect(after[row.id], row.id).toBe(model.rowsById[row.id])
    }
    expect(after.c.original).toBe(next[2])
  })

  it('EN17: ответ ленивых детей добавляет ветку без обхода других корней — getRowId зовётся только для строк ветки, прочие корни — прежние объекты', () => {
    let calls: string[] = []
    const table = build(
      [
        rowExpanding({
          hasChildren: (row: { original: Item }) => row.original.id === 'a',
          loadChildren: () => [],
        }),
      ],
      {
        getRowId: (row: Item) => {
          calls.push(row.id)
          return row.id
        },
      },
    )
    const before = table.getCoreRowModel()
    calls = []
    setLoadedAnswer(table, (prev: object) => ({
      ...prev,
      a: [item('a1', 'Lima'), item('a2', 'Oslo')],
    }))
    const after = table.getCoreRowModel()
    expect(after).not.toBe(before)
    expect([...new Set(calls)].sort()).toEqual(['a', 'a1', 'a2'])
    for (const id of ['b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(after.rowsById[id], id).toBe(before.rowsById[id])
    }
    expect(after.rowsById.a.subRows.map((row: any) => row.id)).toEqual([
      'a1',
      'a2',
    ])
  })

  it('EN18: смена data — замена, вставка, удаление и перенос в середине — не меняет опубликованных строк и словаря прежней модели; итог как у полной сборки', () => {
    const table = build([])
    const fields = (row: any) => ({
      id: row.id,
      index: row.index,
      depth: row.depth,
      parentId: row.parentId,
      original: row.original,
      subRows: row.subRows,
    })
    const steps: ((data: Item[]) => Item[])[] = [
      data => data.map((row, i) => (i === 3 ? { ...row, city: 'Lyon' } : row)),
      data => [...data.slice(0, 2), item('x', 'Rome'), ...data.slice(2)],
      data => data.filter((_, i) => i !== 4),
      data => [data[5]!, ...data.slice(0, 5), ...data.slice(6)],
    ]
    let data = DATA
    for (const [step, change] of steps.entries()) {
      const model = table.getCoreRowModel()
      // Словарь прежней модели читается через модель — своей версии (ADR 0200, §6).
      const entries = Object.entries(model.rowsById).sort()
      const snapshot = new Map<any, ReturnType<typeof fields>>(
        model.flatRows.map((row: any) => [row, fields(row)]),
      )
      data = change(data)
      table.setOptions((o: any) => ({ ...o, data }))
      const next = table.getCoreRowModel()
      expect(next, `шаг ${step}`).not.toBe(model)
      for (const [row, before] of snapshot) {
        expect(fields(row), `шаг ${step}: ${row.id}`).toEqual(before)
      }
      expect(
        Object.entries(model.rowsById).sort(),
        `шаг ${step}: словарь`,
      ).toEqual(entries)
      const fresh = build([], { data })
      expect(
        next.rows.map((row: any) => [row.id, positionOf(row)]),
        `шаг ${step}: места`,
      ).toEqual(
        fresh.getCoreRowModel().rows.map((row: any) => [row.id, row.index]),
      )
    }
  })
})

interface TreeItem {
  id: string
  name: string
  city: string
  subRows?: TreeItem[]
}

const node = (id: string, city: string, subRows?: TreeItem[]): TreeItem => ({
  id,
  name: `Name ${id}`,
  city,
  ...(subRows ? { subRows } : {}),
})
const TREE: TreeItem[] = [
  node('a', 'Paris', [
    node('a1', 'Lima'),
    node('a2', 'Oslo', [node('a21', 'Rome')]),
  ]),
  node('b', 'Rome'),
  node('c', 'Paris', [node('c1', 'Rome'), node('c2', 'Paris')]),
  node('d', 'Oslo'),
  node('e', 'Rome', [node('e1', 'Oslo')]),
  node('f', 'Oslo'),
]

/** Таблица на плагинах грида или на стоковых фабриках моделей TanStack во всех слотах. */
const buildTree = (
  stock: boolean,
  extra: object = {},
  more: readonly unknown[] = [],
) => {
  const entries = [
    REACTIVITY,
    columnSorting(),
    columnFiltering(),
    quickSearch(),
    rowGrouping(),
    rowExpanding(),
    pagination({ initialPageSize: 4 }),
    ...more,
  ]
  const folded = foldEntries(entries as never)
  const features = buildTesseraFeatures(entries as never) as Record<
    string,
    unknown
  >
  return constructTable({
    features: stock
      ? {
          ...features,
          filteredRowModel: createFilteredRowModel(),
          groupedRowModel: createGroupedRowModel(),
          sortedRowModel: createSortedRowModel(),
          expandedRowModel: createExpandedRowModel(),
          paginatedRowModel: createPaginatedRowModel(),
        }
      : features,
    data: TREE,
    columns: injectServiceColumns(COLUMNS as any[], folded.serviceColumns),
    getRowId: (row: TreeItem) => row.id,
    getSubRows: (row: TreeItem) => row.subRows,
    ...folded.options,
    hooks: resolveHooks(foldHooks(entries as never)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
    ...extra,
  } as never) as any
}

describe('Источник строк движка (ADR 0200, этап 4)', () => {
  it('EN2: источник клиентского режима — движок: count, at, byId, indexOf и rows совпадают со стоковыми моделями TanStack при сортировке, фильтре, поиске, группировке, раскрытии и странице, на дереве и группах', () => {
    const ours = buildTree(false)
    const stock = buildTree(true)
    const expectParity = (step: string) => {
      const source = rowSourceOf<any>(ours)
      const { rows } = stock.getRowModel()
      expect(
        source.rows!().map((row: any) => [row.id, row.depth]),
        step,
      ).toEqual(rows.map((row: any) => [row.id, row.depth]))
      expect(source.count(), step).toBe(rows.length)
      rows.forEach((row: any, index: number) => {
        expect(source.at(index)?.id, `${step}: at ${index}`).toBe(row.id)
        expect(source.indexOf(row.id), `${step}: indexOf ${row.id}`).toBe(index)
      })
      for (const id of Object.keys(stock.getCoreRowModel().rowsById)) {
        expect(source.byId(id)?.id, `${step}: byId ${id}`).toBe(id)
      }
    }
    for (const [step, apply] of [
      ['исходно', () => {}],
      ['раскрыто всё', (t: any) => t.setExpanded(true)],
      ['сортировка', (t: any) => t.setSorting([{ id: 'city', desc: true }])],
      ['вторая страница', (t: any) => t.setPageIndex(1)],
      [
        'фильтр',
        (t: any) => {
          t.setPageIndex(0)
          t.setColumnFilters([
            { id: 'city', value: { operator: 'contains', value: 'o' } },
          ])
        },
      ],
      ['поиск', (t: any) => t.setGlobalFilter('Name a')],
      [
        'группировка',
        (t: any) => {
          t.setGlobalFilter('')
          t.setColumnFilters([])
          t.setGrouping(['city'])
        },
      ],
      ['свёрнуто', (t: any) => t.setExpanded({})],
    ] as const) {
      apply(ours)
      apply(stock)
      expectParity(step)
    }
  })
})

/** Модель TanStack для сверки: строки с детьми, плоский список и ключи словаря. */
const modelShape = (model: any) => {
  const node = (row: any): unknown => ({
    id: row.id,
    depth: row.depth,
    subRows: row.subRows.map(node),
  })
  return {
    rows: model.rows.map(node),
    flat: model.flatRows.map((row: any) => row.id),
    byId: Object.keys(model.rowsById).sort(),
  }
}

describe('Стоковый вид и дети показа (ADR 0200, этап 4)', () => {
  it('EN6: getSortedRowModel, getExpandedRowModel и getRowModel дают итог стоковых моделей; вид собирается при вызове и один раз на выход, движок отдаёт строки без копий', () => {
    const ours = buildTree(false)
    const stock = buildTree(true)
    for (const t of [ours, stock]) {
      t.setExpanded(true)
      t.setSorting([{ id: 'city', desc: true }])
      t.setPageSize(100)
    }
    for (const getter of [
      'getSortedRowModel',
      'getExpandedRowModel',
      'getRowModel',
    ] as const) {
      expect(modelShape(ours[getter]()), getter).toEqual(
        modelShape(stock[getter]()),
      )
    }
    const engine = engineOf(ours)
    const sorted = engine.output('sort') as any
    expect(ours.getSortedRowModel()).not.toBe(sorted)
    expect(ours.getSortedRowModel()).toBe(ours.getSortedRowModel())
    const core = ours.getCoreRowModel().rowsById
    for (const row of sorted.flatRows) expect(row, row.id).toBe(core[row.id])
  })

  it('EN16: дерево из getSubRows — порядок показа детей у движка, subRows строк остаются в порядке данных; раскрытие и «раскрыть всё» показывают ветки', () => {
    const table = buildTree(false)
    table.setPageSize(100)
    table.setSorting([{ id: 'city', desc: false }])
    const source = rowSourceOf<any>(table)
    expect(source.rows!().map((row: any) => row.id)).toEqual([
      'd',
      'f',
      'a',
      'c',
      'b',
      'e',
    ])
    table.setExpanded({ a: true })
    expect(source.rows!().map((row: any) => row.id)).toEqual([
      'd',
      'f',
      'a',
      'a1',
      'a2',
      'c',
      'b',
      'e',
    ])
    const a = table.getCoreRowModel().rowsById.a
    expect(a.subRows.map((row: any) => row.id)).toEqual(['a1', 'a2'])
    table.setSorting([{ id: 'city', desc: true }])
    expect(
      source.rows!()
        .map((row: any) => row.id)
        .slice(2, 5),
    ).toEqual(['a', 'a2', 'a1'])
    expect(a.subRows.map((row: any) => row.id)).toEqual(['a1', 'a2'])
    table.setExpanded(true)
    expect(source.count()).toBe(
      Object.keys(table.getCoreRowModel().rowsById).length,
    )
  })
})

describe('Стадия фильтра (ADR 0200, этап 4)', () => {
  it('EN11: фильтры колонок и поиск — итог как у createFilteredRowModel на дереве: filterFromLeafRows вкл и выкл, maxLeafRowFilterDepth 0 и 1, фильтр колонки, поиск и оба вместе', () => {
    for (const filterFromLeafRows of [true, false]) {
      for (const maxLeafRowFilterDepth of [100, 1, 0]) {
        const extra = { filterFromLeafRows, maxLeafRowFilterDepth }
        const ours = buildTree(false, extra)
        const stock = buildTree(true, extra)
        for (const [step, apply] of [
          [
            'фильтр колонки',
            (t: any) =>
              t.setColumnFilters([
                { id: 'city', value: { operator: 'contains', value: 'ro' } },
              ]),
          ],
          ['поиск', (t: any) => t.setGlobalFilter('Name a2')],
          ['снят фильтр колонки', (t: any) => t.setColumnFilters([])],
          ['снят поиск', (t: any) => t.setGlobalFilter('')],
        ] as const) {
          apply(ours)
          apply(stock)
          const label = `${step}, fromLeafs=${filterFromLeafRows}, depth=${maxLeafRowFilterDepth}`
          expect(modelShape(ours.getFilteredRowModel()), label).toEqual(
            modelShape(stock.getFilteredRowModel()),
          )
        }
      }
    }
  })
})

const STAGE_IDS = ['filter', 'group', 'sort', 'expand', 'page'] as const

/** Какие стадии дали новый выход после действия. */
const rerun = (table: any, act: () => void) => {
  const engine = engineOf(table)
  table.getRowModel()
  const before = STAGE_IDS.map(id => engine.output(id))
  act()
  table.getRowModel()
  return STAGE_IDS.filter((id, i) => engine.output(id) !== before[i])
}

describe('Стоковые фичи, пересчёт и страница (ADR 0200, этап 4)', () => {
  it('EN7: выбор и раскрытие всего, число страниц, фасеты, автоматические sortFn и aggregationFn — тот же итог, что со стоковыми моделями', () => {
    const ours = buildTree(false, {}, [rowSelection()])
    const stock = buildTree(true, {}, [rowSelection()])
    const features = (t: any) => {
      const city = t.getColumn('city')
      const name = t.getColumn('name')
      return {
        allSelected: t.getIsAllRowsSelected(),
        someSelected: t.getIsSomeRowsSelected(),
        allPageSelected: t.getIsAllPageRowsSelected(),
        somePageSelected: t.getIsSomePageRowsSelected(),
        selected: modelShape(t.getSelectedRowModel()),
        filteredSelected: modelShape(t.getFilteredSelectedRowModel()),
        groupedSelected: modelShape(t.getGroupedSelectedRowModel()),
        allExpanded: t.getIsAllRowsExpanded(),
        someExpanded: t.getIsSomeRowsExpanded(),
        canSomeExpand: t.getCanSomeRowsExpand(),
        expandedDepth: t.getExpandedDepth(),
        pageCount: t.getPageCount(),
        rowCount: t.getRowCount(),
        canNext: t.getCanNextPage(),
        cityFacet: modelShape(city.getFacetedRowModel()),
        nameFacet: modelShape(name.getFacetedRowModel()),
        sortFns: [city.getAutoSortFn(), name.getAutoSortFn()],
        aggregationFns: [
          city.getAutoAggregationFn(),
          name.getAutoAggregationFn(),
        ],
      }
    }
    expect(features(ours).cityFacet.flat.length).toBeGreaterThan(0)
    for (const [step, apply] of [
      ['исходно', () => {}],
      ['выбрано всё', (t: any) => t.toggleAllRowsSelected(true)],
      ['раскрыто всё', (t: any) => t.toggleAllRowsExpanded(true)],
      ['сортировка', (t: any) => t.setSorting([{ id: 'city', desc: true }])],
      [
        'выбраны ветки',
        (t: any) =>
          t.setRowSelection({ a: true, a1: true, a2: true, c: true, c2: true }),
      ],
      [
        'фильтр имени',
        (t: any) =>
          t.setColumnFilters([
            { id: 'name', value: { operator: 'contains', value: 'Name c' } },
          ]),
      ],
      ['снят выбор страницы', (t: any) => t.toggleAllPageRowsSelected(false)],
      [
        'группировка',
        (t: any) => {
          t.setColumnFilters([])
          t.setGrouping(['city'])
        },
      ],
      ['свёрнуто всё', (t: any) => t.toggleAllRowsExpanded(false)],
      ['вторая страница', (t: any) => t.setPageIndex(1)],
    ] as const) {
      apply(ours)
      apply(stock)
      expect(features(ours), step).toEqual(features(stock))
    }
  })

  it('EN8: смена входа стадии пересчитывает её и стадии ниже; смена data, транзакция и раскрытие пересобирают только затронутые ветки; итог равен полной сборке', () => {
    let data = TREE
    const table = buildTree(false, {
      onDataChange: (next: TreeItem[]) => {
        data = next
        table.setOptions((o: any) => ({ ...o, data }))
      },
    })
    table.setExpanded(true)
    table.setPageSize(100)
    expect(
      rerun(table, () =>
        table.setColumnFilters([
          { id: 'city', value: { operator: 'contains', value: 'o' } },
        ]),
      ),
    ).toEqual(STAGE_IDS)
    expect(rerun(table, () => table.setGrouping(['city']))).toEqual([
      'group',
      'sort',
      'expand',
      'page',
    ])
    table.setGrouping([])
    expect(
      rerun(table, () => table.setSorting([{ id: 'city', desc: true }])),
    ).toEqual(['sort', 'expand', 'page'])
    // Со страницей ветки раскрывает стадия страницы (ADR 0038): выход раскрытия — её вход.
    expect(rerun(table, () => table.setExpanded({ a: true, c: true }))).toEqual(
      ['page'],
    )
    expect(rerun(table, () => table.setPageSize(3))).toEqual(['page'])
    table.setPageSize(100)

    const full = (rows: TreeItem[]) => {
      const fresh = buildTree(false, { data: rows })
      fresh.setColumnFilters(table.store.state.columnFilters)
      fresh.setSorting(table.store.state.sorting)
      fresh.setExpanded(table.store.state.expanded)
      fresh.setPageSize(100)
      return fresh
    }
    /** Дети строки в порядке показа стадии сортировки. */
    const shown = (t: any, id: string) => {
      const output = engineOf(t).output('sort') as any
      const row = output.flatRows.find((other: any) => other.id === id)
      return childrenOf(output, row)
    }
    // Смена data в ветке c: ветка a держит прежний порядок показа.
    table.setColumnFilters([])
    const aBefore = shown(table, 'a')
    expect(aBefore.map(row => row.id)).toEqual(['a2', 'a1'])
    data = data.map(row =>
      row.id === 'c'
        ? { ...row, subRows: [row.subRows![0]!, node('c2', 'Oslo')] }
        : row,
    )
    table.setOptions((o: any) => ({ ...o, data }))
    expect(shown(table, 'a')).toBe(aBefore)
    expect(modelShape(table.getRowModel())).toEqual(
      modelShape(full(data).getRowModel()),
    )
    // Транзакция приложения: новая строка в корнях, ветки прежние.
    const cBefore = shown(table, 'c')
    expect(
      table.applyRowTransaction({ add: [node('g', 'Oslo')], index: 1 }),
    ).toBe('applied')
    expect(shown(table, 'c')).toBe(cBefore)
    expect(shown(table, 'a')).toBe(aBefore)
    expect(modelShape(table.getRowModel())).toEqual(
      modelShape(full(data).getRowModel()),
    )
    // Раскрытие ветки: стадии выше прежние, итог — как у полной сборки.
    expect(rerun(table, () => table.setExpanded({ e: true }))).toEqual(['page'])
    expect(modelShape(table.getRowModel())).toEqual(
      modelShape(full(data).getRowModel()),
    )
  })

  it('EN10: автосбросы страницы и раскрытия — как у стоковых моделей при смене данных, фильтра, поиска и группировки, с autoResetPageIndex и autoResetExpanded вкл и выкл', async () => {
    const flush = async () => {
      for (let i = 0; i < 3; i++) await new Promise(r => setTimeout(r, 0))
    }
    for (const autoReset of [true, false]) {
      const extra = {
        autoResetPageIndex: autoReset,
        autoResetExpanded: autoReset,
      }
      const ours = buildTree(false, extra)
      const stock = buildTree(true, extra)
      for (const [step, apply] of [
        [
          'данные',
          (t: any) => t.setOptions((o: any) => ({ ...o, data: [...TREE] })),
        ],
        [
          'фильтр',
          (t: any) =>
            t.setColumnFilters([
              { id: 'city', value: { operator: 'contains', value: 'o' } },
            ]),
        ],
        ['поиск', (t: any) => t.setGlobalFilter('Name')],
        ['группировка', (t: any) => t.setGrouping(['city'])],
        ['снята группировка', (t: any) => t.setGrouping([])],
      ] as const) {
        for (const t of [ours, stock]) {
          t.setPageSize(2)
          t.setExpanded({ a: true })
          t.setPageIndex(1)
          t.getRowModel()
        }
        await flush()
        for (const t of [ours, stock]) {
          apply(t)
          t.getRowModel()
        }
        await flush()
        for (const t of [ours, stock]) t.getRowModel()
        await flush()
        const state = (t: any) => ({
          pageIndex: t.store.state.pagination.pageIndex,
          expanded: t.store.state.expanded,
        })
        expect(state(ours), `${step}, autoReset=${autoReset}`).toEqual(
          state(stock),
        )
      }
    }
  })

  it('EN13: клиентская страница — по корням вместе с ветками; итог как у createPaginatedRowModel с paginateExpandedRows: false', () => {
    for (const sorting of [[], [{ id: 'city', desc: true }]]) {
      for (const expanded of [true, { a: true, c: true }, {}] as const) {
        const ours = buildTree(false)
        const stock = buildTree(true)
        expect(ours.options.paginateExpandedRows).toBe(false)
        for (const t of [ours, stock]) {
          t.setSorting(sorting)
          t.setExpanded(expanded)
          t.setPageSize(2)
        }
        for (const pageIndex of [0, 1, 2]) {
          for (const t of [ours, stock]) t.setPageIndex(pageIndex)
          const label = `${JSON.stringify(sorting)}, ${JSON.stringify(expanded)}, страница ${pageIndex}`
          expect(modelShape(ours.getPaginatedRowModel()), label).toEqual(
            modelShape(stock.getPaginatedRowModel()),
          )
          expect(
            rowSourceOf<any>(ours).rows!().map((row: any) => row.id),
            label,
          ).toEqual(ids(stock.getRowModel()))
        }
      }
    }
  })
})

describe('Серверная модель на движке (ADR 0200, этап 5)', () => {
  it('EN20: хранилище блоков — второе хранилище движка: источник таблицы — блоки, стадии фильтра, группировки, сортировки, раскрытия и страницы на клиенте не идут', () => {
    const table = build([
      serverRowModel({ getRows: () => ({ rows: [], rowCount: 0 }) }),
      columnSortingModel(),
      columnFilteringModel(),
      rowGroupingModel(),
      rowExpandingModel(),
      paginationModel({ initialPageSize: 3 }),
    ])
    table.setSorting([{ id: 'name', desc: true }])
    table.setColumnFilters([
      { id: 'city', value: { operator: 'contains', value: 'o' } },
    ])
    table.setGrouping(['city'])
    const engine = engineOf(table)
    const core = table.getCoreRowModel()
    for (const id of STAGE_IDS) expect(engine.output(id), id).toBe(core)
    expect((rowSourceOf(table) as { store?: unknown }).store).toBeDefined()
  })
})

/** Запись поля строки TanStack: поля `Row`, кэши с `_` и сборка через `Object.assign`. */
const ROW_WRITE =
  /\b[\w$]+\??\.(?:id|index|depth|parentId|subRows|original|originalSubRows|leafRows|groupingColumnId|groupingValue|columnFilters|columnFiltersMeta|_[A-Za-z]\w*)\s*=(?!=)|\bObject\.assign\((?:row|copy|group|next|fresh)\b/
/** Поле с `_` у объекта, который не таблица: внутренности строк и ячеек TanStack. */
const PRIVATE_READ = /\b(?!t\b|table\b)[A-Za-z]\w*\??\._[A-Za-z]\w*/

/**
 * Где движок создаёт строки и задаёт их поля при создании (ADR 0200, §4), и изменяемые поля,
 * которые объявляет фича TanStack. Это устройство движка, а не долг: список не сокращается.
 */
const ROW_WRITERS: Record<string, string> = {
  'core/rowEngine/memoryStore.ts':
    'хранилище в памяти: дети строки при создании',
  'core/dataChanges.ts':
    'новые строки смены data: дети при создании (ADR 0194)',
  'core/rowEngine/stockView.ts':
    'копии стокового вида для table.get*RowModel() с детьми показа (ADR 0200, §6)',
  'plugins/rowExpanding/lazyCoreRowModel.ts':
    'строки ленивого дерева и строка с ответом и её предки — при создании (ADR 0200, §4)',
  'plugins/rowGroupingModel/groupStage.ts':
    'строки-группы при создании; depth и parentId листьев под группами (ADR 0200, §4)',
  'plugins/serverRowModel/source.ts':
    'строки блока и строки-группы серверной модели при создании (ADR 0138, 0144)',
  'shared/rowModels/filteredRowModel.ts':
    'columnFilters и columnFiltersMeta отбора; копии родителей фильтра дерева (ADR 0200, §4)',
}

/** Совпадения шаблона записи, которые не про строки: свой объект модуля. */
const NOT_ROWS: Record<string, string> = {
  'grid/useSkeletonWave.ts': 'id анимации волны скелета (Web Animations)',
  'plugins/cellSelectionModel/indexSelection.ts':
    'флаг таблицы на время протяжки выделения',
}

describe('Строки движка (ADR 0200, этап 5)', () => {
  it('EN3: поля строки пишет только движок при создании и изменяемые поля фич TanStack; полей строк с _ никто не читает', () => {
    const root = join(__dirname, '..')
    const writers: string[] = []
    const privateReads: string[] = []
    for (const file of sources(root)) {
      const name = relative(root, file).replace(/\\/g, '/')
      const text = readFileSync(file, 'utf8')
        .split('\n')
        .filter(line => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
        .join('\n')
      if (ROW_WRITE.test(text) && !(name in NOT_ROWS)) writers.push(name)
      const read = text.match(PRIVATE_READ)
      if (read) privateReads.push(`${name}: ${read[0]}`)
    }
    expect(writers.sort()).toEqual(Object.keys(ROW_WRITERS).sort())
    expect(privateReads).toEqual([])
  })
})

/** Детерминированный генератор для цепочек смен. */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const CITIES = ['Paris', 'Rome', 'Oslo', 'Lima', 'Bonn']

/** Узлы дерева с путём родителей: смены — неизменяемыми копиями ветки. */
const nodesOf = (tree: TreeItem[], into: TreeItem[] = []) => {
  for (const item of tree) {
    into.push(item)
    if (item.subRows) nodesOf(item.subRows, into)
  }
  return into
}
const mapTree = (
  tree: TreeItem[],
  fn: (level: TreeItem[], parent?: TreeItem) => TreeItem[],
  parent?: TreeItem,
): TreeItem[] =>
  fn(tree, parent).map(item =>
    item.subRows
      ? (() => {
          const kids = mapTree(item.subRows, fn, item)
          return kids === item.subRows ? item : { ...item, subRows: kids }
        })()
      : item,
  )

describe('Набор изменений (ADR 0200, этап 5)', () => {
  it('EN32: стадии не читают словарь прежнего входа; цепочка смен data — правка, вставка, удаление, перенос — и ответов ленивых детей при фильтре и сортировке даёт итог полной сборки', () => {
    const root = join(__dirname, '..')
    const readers = sources(root)
      .filter(file =>
        /\b(?:prev|last)\.input\.rowsById\b/.test(readFileSync(file, 'utf8')),
      )
      .map(file => relative(root, file).replace(/\\/g, '/'))
    expect(readers).toEqual([])
    // Выход этих стадий делит словарь со входом.
    for (const file of [
      'plugins/columnSortingModel/sortedRowModel.ts',
      'shared/rowModels/expandedRowModel.ts',
      'plugins/paginationModel/pageStage.ts',
    ]) {
      expect(readFileSync(join(root, file), 'utf8'), file).not.toMatch(
        /\bprev\.output\.rowsById\b/,
      )
    }

    const next = random(200)
    const pick = <T>(list: readonly T[]) =>
      list[Math.floor(next() * list.length)]!
    let created = 0
    const STATE = (t: any) => {
      t.setColumnFilters([
        { id: 'city', value: { operator: 'contains', value: 'o' } },
      ])
      t.setSorting([{ id: 'city', desc: true }])
      t.setExpanded(true)
      t.setPageSize(1000)
    }
    const shape = (t: any) =>
      rowSourceOf<any>(t).rows!().map((row: any) => `${row.id}:${row.depth}`)

    let data = TREE
    const table = buildTree(false)
    STATE(table)
    shape(table)
    for (let step = 0; step < 40; step++) {
      const op = pick(['edit', 'insert', 'remove', 'move'] as const)
      const target = pick(nodesOf(data))
      if (op === 'edit') {
        const city = pick(CITIES)
        data = mapTree(data, level =>
          level.includes(target)
            ? level.map(item => (item === target ? { ...item, city } : item))
            : level,
        )
      } else if (op === 'insert') {
        const fresh = node(`n${created++}`, pick(CITIES))
        data = mapTree(data, level => {
          if (!level.includes(target)) return level
          const at = level.indexOf(target)
          return [...level.slice(0, at), fresh, ...level.slice(at)]
        })
      } else if (op === 'remove' && nodesOf(data).length > 4) {
        data = mapTree(data, level =>
          level.includes(target)
            ? level.filter(item => item !== target)
            : level,
        )
      } else if (op === 'move' && data.length > 2) {
        const from = Math.floor(next() * data.length)
        const moved = data[from]!
        const rest = data.filter((_, i) => i !== from)
        const to = Math.floor(next() * rest.length)
        data = [...rest.slice(0, to), moved, ...rest.slice(to)]
      }
      table.setOptions((o: any) => ({ ...o, data }))
      const fresh = buildTree(false, { data })
      STATE(fresh)
      expect(shape(table), `шаг ${step}: ${op}`).toEqual(shape(fresh))
    }

    // Ответы ленивых детей при сортировке: приход, замена и удаление ответа.
    const lazy = () =>
      build([
        rowExpanding({
          hasChildren: (row: { original: Item }) =>
            ['a', 'c', 'e', 'g'].includes(row.original.id),
          loadChildren: () => [],
        }),
        columnSortingModel(),
      ])
    const LAZY_STATE = (t: any) => {
      t.setSorting([{ id: 'city', desc: true }])
      t.setExpanded(true)
    }
    const lazyTable = lazy()
    LAZY_STATE(lazyTable)
    shape(lazyTable)
    let answers: Record<string, Item[]> = {}
    for (let step = 0; step < 20; step++) {
      const parent = pick(['a', 'c', 'e', 'g'])
      answers =
        next() < 0.3
          ? Object.fromEntries(
              Object.entries(answers).filter(([id]) => id !== parent),
            )
          : {
              ...answers,
              [parent]: Array.from(
                { length: 1 + Math.floor(next() * 3) },
                (_, k) => item(`${parent}${step}-${k}`, pick(CITIES)),
              ),
            }
      setLoadedAnswer(lazyTable, () => answers)
      const fresh = lazy()
      LAZY_STATE(fresh)
      setLoadedAnswer(fresh, () => answers)
      expect(shape(lazyTable), `ответ ${step}`).toEqual(shape(fresh))
    }
  })
})

describe('Словарь хранилища на месте (ADR 0200, этап 5)', () => {
  it('EN30: словарь хранилища один и правится на месте — смена data, вставка и удаление в середине, транзакция и ответ ленивых детей; текущий словарь — обычный объект, не прокси', () => {
    let data = DATA
    const table = build([], {
      onDataChange: (next: Item[]) => {
        data = next
        table.setOptions((o: any) => ({ ...o, data }))
      },
    })
    const live = table.getCoreRowModel().rowsById
    expect(types.isProxy(live)).toBe(false)
    const steps: [string, () => void][] = [
      [
        'правка',
        () =>
          (data = data.map((r, i) => (i === 3 ? { ...r, city: 'Lyon' } : r))),
      ],
      [
        'вставка',
        () =>
          (data = [...data.slice(0, 2), item('x', 'Rome'), ...data.slice(2)]),
      ],
      ['удаление', () => (data = data.filter(r => r.id !== 'e'))],
    ]
    for (const [step, change] of steps) {
      change()
      table.setOptions((o: any) => ({ ...o, data }))
      const now = table.getCoreRowModel().rowsById
      expect(now, step).toBe(live)
      expect(Object.keys(now).sort(), step).toEqual(data.map(r => r.id).sort())
    }
    expect(
      table.applyRowTransaction({ add: [item('y', 'Oslo')], index: 0 }),
    ).toBe('applied')
    expect(table.getCoreRowModel().rowsById).toBe(live)
    expect(live.y?.original).toEqual(item('y', 'Oslo'))

    const lazy = build([
      rowExpanding({
        hasChildren: (row: { original: Item }) => row.original.id === 'a',
        loadChildren: () => [],
      }),
    ])
    const lazyLive = lazy.getCoreRowModel().rowsById
    setLoadedAnswer(lazy, (prev: object) => ({
      ...prev,
      a: [item('a1', 'Lima')],
    }))
    expect(lazy.getCoreRowModel().rowsById).toBe(lazyLive)
    expect(types.isProxy(lazyLive)).toBe(false)
    expect(lazyLive.a1?.id).toBe('a1')
  })

  it('EN31: модели table.get*RowModel(), отданные до смены, не меняются после неё — строки и словарь своей версии; текущая модель и getRow читают хранилище', () => {
    let data = DATA
    const table = build([columnSortingModel(), columnFilteringModel()])
    table.setSorting([{ id: 'city', desc: true }])
    const getters = [
      'getCoreRowModel',
      'getSortedRowModel',
      'getRowModel',
    ] as const
    const shapeOf = (model: any) => ({
      rows: model.rows.map((row: any) => row.id),
      byId: Object.entries(model.rowsById)
        .map(([id, row]: [string, any]) => `${id}:${row.original.city}`)
        .sort(),
    })
    const held = getters.map(getter => table[getter]())
    const before = held.map(shapeOf)
    const live = table.getCoreRowModel().rowsById
    // Смены по одной — каждая правит словарь хранилища на месте.
    for (const change of [
      (rows: Item[]) => rows.filter(r => r.id !== 'b'),
      (rows: Item[]) =>
        rows.map(r => (r.id === 'c' ? { ...r, city: 'Bonn' } : r)),
      (rows: Item[]) => [...rows, item('z', 'Oslo')],
    ]) {
      data = change(data)
      table.setOptions((o: any) => ({ ...o, data }))
      table.getRowModel()
      expect(table.getCoreRowModel().rowsById).toBe(live)
    }
    held.forEach((model, i) =>
      expect(shapeOf(model), getters[i]).toEqual(before[i]),
    )
    expect(table.getRow('c').original.city).toBe('Bonn')
    expect(table.getRow('z').id).toBe('z')
    expect(table.getCoreRowModel().rowsById.b).toBeUndefined()
  })
})
