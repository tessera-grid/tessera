/**
 * Своя отсортированная модель (ADR 0064, SM1–SM6): одни сценарии через фабрику
 * Tessera и `createSortedRowModel` TanStack — порядок обязан совпасть. Сортировка из
 * прошлой модели при приходе ответа (ADR 0072, SM8–SM11).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import {
  constructTable,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_alphanumericCaseSensitive,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  sortFn_textCaseSensitive,
  stockFeatures,
  tableFeatures,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { createTesseraSortedRowModel } from '../plugins/columnSortingModel/sortedRowModel'
import {
  type LoadedChildren,
  readLoadedChildren,
  rowExpandingLazyFeature,
  setLoadedAnswer,
} from '../plugins/rowExpanding/lazyChildrenFeature'
import { createLazyCoreRowModel } from '../plugins/rowExpanding/lazyCoreRowModel'

interface Item {
  id: string
  name?: string
  num?: number
  date?: Date
  extra?: number
  children?: Item[]
}

const sortFns = {
  alphanumeric: sortFn_alphanumeric,
  alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive,
  text: sortFn_text,
  textCaseSensitive: sortFn_textCaseSensitive,
  datetime: sortFn_datetime,
  basic: sortFn_basic,
}

const day = (n: number) => new Date(2026, 0, n)

const FLAT: Item[] = [
  { id: 'a', name: 'item 10', num: 3, date: day(5), extra: 2 },
  { id: 'b', name: 'Item 2', num: undefined, date: day(1), extra: 9 },
  { id: 'c', name: 'item 1', num: 3, date: undefined, extra: 1 },
  { id: 'd', name: 'beta', num: -1, date: day(5), extra: 5 },
  { id: 'e', name: 'Beta', num: undefined, date: day(3), extra: 2 },
  { id: 'f', name: 'item 2', num: 0, date: day(2), extra: 7 },
]

const TREE: Item[] = [
  {
    id: 'p1',
    name: 'b',
    num: 2,
    children: [
      { id: 'p1-1', name: 'z', num: 1 },
      { id: 'p1-2', name: 'a', num: 1 },
      {
        id: 'p1-3',
        name: 'm',
        num: 1,
        children: [
          { id: 'p1-3-1', name: 'y', num: 0 },
          { id: 'p1-3-2', name: 'c', num: 0 },
        ],
      },
    ],
  },
  {
    id: 'p2',
    name: 'a',
    num: 2,
    children: [{ id: 'p2-1', name: 'q', num: 1 }],
  },
  { id: 'p3', name: 'c', num: 1 },
]

type Factory = () => ReturnType<typeof createSortedRowModel>

const build = (
  factory: Factory,
  data: Item[],
  columnExtra: Record<string, object> = {},
) =>
  constructTable({
    features: tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
      rowSortingFeature,
      rowPaginationFeature,
      sortedRowModel: factory(),
      paginatedRowModel: createPaginatedRowModel(),
      sortFns,
    } as never),
    data,
    columns: [
      { id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' },
      {
        id: 'nameCase',
        accessorKey: 'name',
        sortFn: 'alphanumericCaseSensitive',
      },
      { id: 'text', accessorKey: 'name', sortFn: 'text' },
      { id: 'textCase', accessorKey: 'name', sortFn: 'textCaseSensitive' },
      { id: 'num', accessorKey: 'num', sortFn: 'basic', ...columnExtra.num },
      { id: 'date', accessorKey: 'date', sortFn: 'datetime' },
      { id: 'auto', accessorKey: 'name' },
      { id: 'extra', accessorKey: 'extra', ...columnExtra.extra },
    ],
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.children,
    initialState: { pagination: { pageIndex: 0, pageSize: 1000 } },
  } as never) as any

type Sorting = { id: string; desc: boolean }[]

/** Порядок плоских строк и структура дерева после сортировки. */
const order = (table: any, sorting: Sorting) => {
  table.setSorting(sorting)
  const model = table.getSortedRowModel()
  const tree = (rows: any[]): unknown =>
    rows.map(row => (row.subRows.length ? [row.id, tree(row.subRows)] : row.id))
  return {
    flat: model.flatRows.map((row: any) => row.id),
    tree: tree(model.rows),
  }
}

const parity = (
  data: Item[],
  sortings: Sorting[],
  columnExtra?: Record<string, object>,
) => {
  for (const sorting of sortings) {
    const ours = order(
      build(createTesseraSortedRowModel, data, columnExtra),
      sorting,
    )
    const theirs = order(
      build(createSortedRowModel, data, columnExtra),
      sorting,
    )
    expect(ours, JSON.stringify(sorting)).toEqual(theirs)
  }
}

const both = (id: string): Sorting[] => [
  [{ id, desc: false }],
  [{ id, desc: true }],
]

describe('своя отсортированная модель', () => {
  it('SM1: порядок как у TanStack для встроенных функций, одной колонкой и мультисортировкой, в обе стороны', () => {
    parity(FLAT, [
      ...[
        'name',
        'nameCase',
        'text',
        'textCase',
        'num',
        'date',
        'auto',
      ].flatMap(both),
      [
        { id: 'num', desc: false },
        { id: 'name', desc: true },
      ],
      [
        { id: 'date', desc: true },
        { id: 'text', desc: false },
      ],
    ])
  })

  it("SM2: порядок как у TanStack при sortUndefined (1, -1, 'first', 'last', false) и invertSorting", () => {
    for (const sortUndefined of [1, -1, 'first', 'last', false]) {
      for (const invertSorting of [false, true]) {
        parity(
          FLAT,
          [
            ...both('num'),
            [
              { id: 'num', desc: false },
              { id: 'name', desc: true },
            ],
          ],
          {
            num: { sortUndefined, invertSorting },
          },
        )
      }
    }
  })

  it('SM3: порядок как у TanStack на дереве (каждый уровень) и устойчив при равных значениях', () => {
    parity(TREE, [
      ...both('name'),
      ...both('num'),
      [
        { id: 'num', desc: true },
        { id: 'name', desc: false },
      ],
    ])
    // Все значения равны — порядок исходный.
    const same = FLAT.map(item => ({ ...item, num: 1 }))
    const ours = order(build(createTesseraSortedRowModel, same), [
      { id: 'num', desc: true },
    ])
    expect(ours.flat).toEqual(same.map(item => item.id))
  })

  it('SM4: свой sortFn получает настоящие строки, порядок как у TanStack', () => {
    const seen: unknown[] = []
    const sortFn = (a: any, b: any) => {
      seen.push(a.original, b.original)
      return a.original.extra - b.original.extra
    }
    parity(FLAT, both('extra'), { extra: { sortFn } })
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every(original => FLAT.includes(original as Item))).toBe(true)
  })

  it('SM5: rowsById указывает на строки модели, в том числе на копии родителей с переставленными детьми', () => {
    const table = build(createTesseraSortedRowModel, TREE)
    table.setSorting([{ id: 'name', desc: false }])
    const model = table.getSortedRowModel()
    for (const row of model.flatRows) {
      expect(model.rowsById[row.id], row.id).toBe(row)
    }
    // p1 — родитель с переставленными детьми: в модели копия, а не оригинал.
    expect(model.rowsById.p1).not.toBe(table.getPreSortedRowModel().rowsById.p1)
  })

  it('SM6: без сортировки — исходная модель; при тех же входах — тот же объект; смена сортировки сбрасывает страницу', async () => {
    const table = build(createTesseraSortedRowModel, FLAT)
    expect(table.getSortedRowModel()).toBe(table.getPreSortedRowModel())

    table.setSorting([{ id: 'name', desc: false }])
    const first = table.getSortedRowModel()
    expect(table.getSortedRowModel()).toBe(first)

    for (const factory of [createTesseraSortedRowModel, createSortedRowModel]) {
      const paged = build(factory as Factory, FLAT)
      paged.setPagination({ pageIndex: 0, pageSize: 2 })
      paged.getRowModel()
      paged.setPageIndex(2)
      paged.setSorting([{ id: 'num', desc: false }])
      paged.getRowModel()
      // Сброс страницы TanStack ставит в очередь реактивности.
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(paged.atoms.pagination.get().pageIndex, factory.name).toBe(0)
    }
  })
})

// Сортировка из прошлой модели (ADR 0072): ленивые ответы над исходной моделью
// ADR 0067 против полной сортировки TanStack на тех же данных и ответах.
interface Node {
  id: string
  name: string
  num: number
}

const ROOTS: Node[] = Array.from({ length: 10 }, (_, i) => ({
  id: `r${i}`,
  name: `n${(i * 7) % 10}`,
  num: i % 3,
}))
const kidsOf = (id: string, tag: string): Node[] =>
  [3, 1, 2].map(i => ({ id: `${id}-${tag}${i}`, name: `k${i}`, num: i % 2 }))

const LAZY_COLUMNS = [
  { id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' },
  { id: 'num', accessorKey: 'num', sortFn: 'basic' },
]

const lazyTable = (sorting: Sorting, columns: object[] = LAZY_COLUMNS) =>
  constructTable({
    features: tableFeatures({
      ...stockFeatures,
      coreReactivityFeature: storeReactivityBindings(),
      rowExpandingLazyFeature,
      coreRowModel: createLazyCoreRowModel(),
      sortedRowModel: createTesseraSortedRowModel(),
      sortFns,
    } as never),
    data: ROOTS,
    columns,
    getRowId: (row: Node) => row.id,
    initialState: { sorting },
  } as never) as any

const answer = (table: any, update: (prev: LoadedChildren) => LoadedChildren) =>
  setLoadedAnswer(table, update)

/** Полная сортировка TanStack на данных и ответах таблицы. */
const fullOf = (table: any, columns: object[] = LAZY_COLUMNS) => {
  const answers = readLoadedChildren(table)
  const reference = constructTable({
    features: tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
      rowSortingFeature,
      sortedRowModel: createSortedRowModel(),
      sortFns,
    } as never),
    data: table.options.data,
    columns,
    getRowId: (row: Node) => row.id,
    getSubRows: (row: Node) => answers[row.id] as Node[] | undefined,
    initialState: { sorting: table.atoms.sorting.get() },
  } as never) as any
  return reference.getSortedRowModel()
}

const treeOf = (rows: any[]): unknown =>
  rows.map(row => (row.subRows.length ? [row.id, treeOf(row.subRows)] : row.id))
const shapeOf = (model: any) => ({
  tree: treeOf(model.rows),
  flat: model.flatRows.map((row: any) => row.id),
})
/** Модель совпадает с полной сортировкой; `rowsById` — на строки модели. */
const expectFull = (table: any, step: string, columns?: object[]) => {
  const model = table.getSortedRowModel()
  expect(shapeOf(model), step).toEqual(shapeOf(fullOf(table, columns)))
  expect(Object.keys(model.rowsById).sort(), step).toEqual(
    model.flatRows.map((row: any) => row.id).sort(),
  )
  for (const row of model.flatRows) {
    expect(model.rowsById[row.id], `${step}: ${row.id}`).toBe(row)
  }
}

describe('сортировка из прошлой модели (ADR 0072)', () => {
  it('SM8: после прихода ответа при активной сортировке модель совпадает с полной сортировкой', () => {
    const table = lazyTable([{ id: 'name', desc: false }])
    expectFull(table, 'начало')
    answer(table, prev => ({ ...prev, r3: kidsOf('r3', 'a') }))
    expectFull(table, 'приход')
    answer(table, prev => ({ ...prev, 'r3-a1': kidsOf('r3-a1', 'b') }))
    expectFull(table, 'вложенный приход')
  })

  it('SM9: паритет при замене и удалении ответа, пачке ответов и мультисортировке', () => {
    const table = lazyTable([
      { id: 'num', desc: true },
      { id: 'name', desc: false },
    ])
    table.getSortedRowModel()
    answer(table, prev => ({
      ...prev,
      r1: kidsOf('r1', 'a'),
      r7: kidsOf('r7', 'a'),
    }))
    expectFull(table, 'пачка')
    answer(table, prev => ({ ...prev, r1: kidsOf('r1', 'z') }))
    expectFull(table, 'замена')
    answer(table, ({ r7: _removed, ...rest }) => rest)
    expectFull(table, 'удаление')
  })

  it('SM10: полная сортировка при смене сортировки, числа корней, original строки и своей sortFn — как у TanStack', () => {
    const table = lazyTable([{ id: 'name', desc: false }])
    answer(table, prev => ({ ...prev, r2: kidsOf('r2', 'a') }))
    table.getSortedRowModel()
    table.setSorting([{ id: 'name', desc: true }])
    expectFull(table, 'смена сортировки')
    table.setOptions((o: any) => ({
      ...o,
      data: [...ROOTS, { id: 'r10', name: 'n0', num: 9 }],
    }))
    expectFull(table, 'больше корней')

    // Своя sortFn без контракта видит детей строки: приход меняет порядок корней.
    const byKids = [
      {
        id: 'kids',
        accessorKey: 'name',
        sortFn: (a: any, b: any) => a.subRows.length - b.subRows.length,
      },
    ]
    const custom = lazyTable([{ id: 'kids', desc: true }], byKids)
    custom.getSortedRowModel()
    answer(custom, prev => ({ ...prev, r8: kidsOf('r8', 'a') }))
    expect(custom.getSortedRowModel().rows[0].id).toBe('r8')
    expectFull(custom, 'своя sortFn', byKids)

    // Корень на той же позиции входа с другим original: значения сортировки другие.
    const source = (data: Node[]) =>
      constructTable({
        features: tableFeatures({
          coreReactivityFeature: storeReactivityBindings(),
        } as never),
        data,
        columns: LAZY_COLUMNS,
        getRowId: (row: Node) => row.id,
      } as never) as any
    const before = source(ROOTS).getCoreRowModel()
    const renamed = ROOTS.map(row =>
      row.id === 'r4' ? { ...row, name: 'a-first' } : row,
    )
    const after = source(renamed).getCoreRowModel()
    const swapped = {
      rows: before.rows.map((row: any) =>
        row.id === 'r4' ? after.rowsById.r4 : row,
      ),
      flatRows: before.flatRows.map((row: any) =>
        row.id === 'r4' ? after.rowsById.r4 : row,
      ),
      rowsById: { ...before.rowsById, r4: after.rowsById.r4 },
    }
    let input = before
    const fed = constructTable({
      features: tableFeatures({
        ...stockFeatures,
        coreReactivityFeature: storeReactivityBindings(),
        coreRowModel: () => () => input,
        sortedRowModel: createTesseraSortedRowModel(),
        sortFns,
      } as never),
      data: ROOTS,
      columns: LAZY_COLUMNS,
      getRowId: (row: Node) => row.id,
      initialState: { sorting: [{ id: 'name', desc: false }] },
    } as never) as any
    fed.getSortedRowModel()
    input = swapped
    fed.setOptions((o: any) => ({ ...o }))
    expect(fed.getSortedRowModel().rows.map((row: any) => row.id)).toEqual(
      fullOf({ ...fed, options: { data: renamed } }).rows.map(
        (row: any) => row.id,
      ),
    )
  })

  it('SM11: прежняя модель после прихода не меняется — rowsById, flatRows и копии родителей', () => {
    const table = lazyTable([{ id: 'name', desc: false }])
    answer(table, prev => ({ ...prev, r5: kidsOf('r5', 'a') }))
    const first = table.getSortedRowModel()
    const firstShape = shapeOf(first)
    const firstIndex = Object.entries(first.rowsById).sort()
    const firstParent = first.rowsById.r5
    const firstKids = firstParent.subRows.map((row: any) => row.id)
    expect(firstParent).not.toBe(table.getCoreRowModel().rowsById.r5)
    answer(table, prev => ({ ...prev, r5: kidsOf('r5', 'b') }))
    answer(table, prev => ({ ...prev, r9: kidsOf('r9', 'a') }))
    table.getSortedRowModel()
    expect(shapeOf(first)).toEqual(firstShape)
    expect(Object.entries(first.rowsById).sort()).toEqual(firstIndex)
    expect(firstParent.subRows.map((row: any) => row.id)).toEqual(firstKids)
    expectFull(table, 'после двух приходов')
  })
})
