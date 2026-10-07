/**
 * `aria-*` дерева без объекта на строку (ADR 0065, TA1–TA2): счёт совпадает с прежним
 * алгоритмом (соседи по `parentId` в модели строк) на настоящих моделях TanStack.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import {
  columnFilteringFeature,
  columnGroupingFeature,
  constructTable,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  filterFns,
  aggregationFns,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { getTreeAria } from '../grid/treeAria'
import { createTesseraSortedRowModel } from '../plugins/columnSorting/sortedRowModel'

interface Item {
  id: string
  name: string
  team: string
  children?: Item[]
}

interface TreeRow {
  id: string
  depth: number
  parentId?: string
}

/** Эталон — прежний алгоритм тела: соседи по `parentId`, объект на строку. */
const reference = (rows: readonly TreeRow[]) => {
  const siblings = new Map<string, TreeRow[]>()
  for (const row of rows) {
    const key = row.parentId ?? ''
    siblings.set(key, [...(siblings.get(key) ?? []), row])
  }
  return rows.map(row => {
    const group = siblings.get(row.parentId ?? '')!
    return [group.length, group.indexOf(row) + 1]
  })
}

const expectParity = (rows: readonly TreeRow[], label: string) => {
  const aria = getTreeAria(rows)
  const ours = rows.map((_, i) => [aria.setSize(i), aria.posInSet(i)])
  expect(ours, label).toEqual(reference(rows))
}

/** Дерево глубины 3: у каждого узла `breadth` детей. */
const makeTree = (prefix: string, depth: number, breadth: number): Item[] =>
  Array.from({ length: breadth }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `${String.fromCharCode(122 - ((i * 7) % 26))}${i}`,
    team: `t${i % 3}`,
    children: depth > 1 ? makeTree(`${prefix}${i}-`, depth - 1, breadth) : [],
  }))

const DATA = makeTree('n', 3, 4)

const build = () =>
  constructTable({
    features: tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
      rowExpandingFeature,
      columnFilteringFeature,
      columnGroupingFeature,
      rowSortingFeature,
      rowPaginationFeature,
      filteredRowModel: createFilteredRowModel(),
      groupedRowModel: createGroupedRowModel(),
      sortedRowModel: createTesseraSortedRowModel(),
      expandedRowModel: createExpandedRowModel(),
      paginatedRowModel: createPaginatedRowModel(),
      filterFns,
      aggregationFns,
      sortFns: { alphanumeric: sortFn_alphanumeric },
    } as never),
    data: DATA,
    columns: [
      { id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' },
      { id: 'team', accessorKey: 'team' },
    ],
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.children,
    paginateExpandedRows: false,
    filterFromLeafRows: true,
    initialState: {
      expanded: true,
      pagination: { pageIndex: 0, pageSize: 1000 },
    },
  } as never) as any

const rows = (table: any): TreeRow[] => table.getRowModel().rows

describe('aria-* дерева', () => {
  it('TA1: setsize и posinset как у эталона — дерево, группы, фильтр, сортировка, страница', () => {
    const table = build()
    expectParity(rows(table), 'дерево')

    table.setColumnFilters([{ id: 'name', value: '1' }])
    expectParity(rows(table), 'фильтр')
    table.setColumnFilters([])

    table.setSorting([{ id: 'name', desc: true }])
    expectParity(rows(table), 'сортировка')
    table.setSorting([])

    table.setPagination({ pageIndex: 1, pageSize: 2 })
    expect(rows(table)[0].id).toBe('n2')
    expectParity(rows(table), 'страница')
    table.setPagination({ pageIndex: 0, pageSize: 1000 })

    table.setGrouping(['team'])
    expect(rows(table).some(row => row.depth > 0)).toBe(true)
    expectParity(rows(table), 'группы')
  })

  it('TA2: родителя нет среди строк или порядок не древесный — как у эталона', () => {
    const tree = rows(build())
    // Родитель убран: дети остаются со своим parentId.
    expectParity(
      tree.filter(row => row.id !== 'n1'),
      'без родителя',
    )
    // Порядок не древесный: потомки первого узла — в конце.
    const first = tree.filter(row => row.id.startsWith('n0-'))
    expectParity(
      [...tree.filter(row => !row.id.startsWith('n0-')), ...first],
      'не древесный',
    )
  })
})
