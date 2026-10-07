/**
 * Своя отсортированная модель (ADR 0064, SM1–SM6): одни сценарии через фабрику
 * Tessera и `createSortedRowModel` TanStack — порядок обязан совпасть.
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
  tableFeatures,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { createTesseraSortedRowModel } from '../plugins/columnSorting/sortedRowModel'

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
