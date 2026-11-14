// @vitest-environment happy-dom
/**
 * Сквозные `aria-posinset`/`aria-setsize` строк верхнего уровня (ADR 0226): место страницы в
 * списке от ядра, поправка счёта строк модели — как в теле грида.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { rootWindowOf } from '../core/pagination'
import { rowSourceOf } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import { getTreeAria, withRootWindow } from '../grid/treeAria'
import {
  columnSortingModel,
  infiniteScroll,
  pagination,
  quickSearchModel,
  rowExpanding,
  rowGrouping,
} from '../plugins'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  team: string
  subRows?: Item[]
}

/** `count` строк верхнего уровня; у каждой третьей — две вложенные. */
const makeData = (count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `r${index}`,
    name: `Name ${String(index).padStart(3, '0')}`,
    team: `Team ${index % 4}`,
    subRows:
      index % 3 === 0
        ? [0, 1].map(child => ({
            id: `r${index}.${child}`,
            name: `Child ${index}.${child}`,
            team: `Team ${index % 4}`,
          }))
        : undefined,
  }))

const COLUMNS = [
  { id: 'name', accessorKey: 'name' },
  { id: 'team', accessorKey: 'team' },
]

let table: any
let root: Root | undefined

const mount = (options: Record<string, unknown>) => {
  const Host = () => {
    table = useCreateTable({
      columns: COLUMNS as never,
      getRowId: (row: Item) => row.id,
      getSubRows: (row: Item) => row.subRows,
      ...options,
    } as never)
    return null
  }
  root = createRoot(document.createElement('div'))
  act(() => root!.render(<Host />))
}

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

interface RowAria {
  id: string
  depth: number
  pos: number
  size: number
}

/** Атрибуты строк страницы — так их ставит тело грида. */
const ariaOf = (): RowAria[] => {
  const rows = table.getRowModel().rows
  const roots = rootWindowOf(table, rowSourceOf(table))
  const aria = withRootWindow(
    getTreeAria(rows),
    rows,
    roots.offset,
    roots.total,
  )
  return rows.map((row: any, index: number) => ({
    id: row.id,
    depth: row.depth,
    pos: aria.posInSet(index),
    size: aria.setSize(index),
  }))
}

const topLevel = () => ariaOf().filter(row => row.depth === 0)

describe('aria-* дерева сквозь страницы', () => {
  it('SZ1: клиентская пагинация — строки верхнего уровня со смещением страницы и итогом списка до нарезки на первой, средней и последней странице, после сортировки, поиска и группировки; вложенные — среди соседей ветки', () => {
    mount({
      data: makeData(60),
      plugins: [
        rowExpanding({ initialExpanded: true }),
        pagination({ initialPageSize: 25 }),
        columnSortingModel(),
        quickSearchModel(),
        rowGrouping(),
      ],
    })

    const first = topLevel()
    expect(first.map(row => row.pos)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    )
    expect(new Set(first.map(row => row.size))).toEqual(new Set([60]))
    // Вложенные: две у каждой третьей строки — среди соседей ветки, как W10.
    const children = ariaOf().filter(row => row.depth === 1)
    expect(children.length).toBeGreaterThan(0)
    expect(children.map(row => [row.pos, row.size])).toEqual(
      children.map((_, index) => [(index % 2) + 1, 2]),
    )

    act(() => table.setPageIndex(1))
    const middle = topLevel()
    expect(middle[0]).toMatchObject({ id: 'r25', pos: 26, size: 60 })
    expect(middle.at(-1)).toMatchObject({ id: 'r49', pos: 50, size: 60 })

    act(() => table.setPageIndex(2))
    const last = topLevel()
    expect(last).toHaveLength(10)
    expect(last[0]).toMatchObject({ pos: 51, size: 60 })
    expect(last.at(-1)).toMatchObject({ pos: 60, size: 60 })

    // Сортировка сбрасывает страницу (PG10); место — по новому порядку.
    act(() => table.setSorting([{ id: 'name', desc: true }]))
    act(() => table.setPageIndex(1))
    expect(topLevel()[0]).toMatchObject({ id: 'r34', pos: 26, size: 60 })
    act(() => table.setSorting([]))

    // Поиск: итог — строки верхнего уровня после отбора.
    act(() => table.setGlobalFilter('Name 01'))
    act(() => table.setPageIndex(0))
    expect(topLevel().map(row => [row.pos, row.size])).toEqual(
      Array.from({ length: 10 }, (_, index) => [index + 1, 10]),
    )
    act(() => table.setGlobalFilter(''))

    // Группировка: строки верхнего уровня — группы.
    act(() => table.setGrouping(['team']))
    act(() => table.setPagination({ pageIndex: 1, pageSize: 3 }))
    expect(topLevel().map(row => [row.pos, row.size])).toEqual([[4, 4]])
  })

  it('SZ3: серверная пагинация — строки верхнего уровня страницы со смещением страницы и rowCount; без известного rowCount пагинация инертна, счёт по строкам страницы', () => {
    const page = makeData(25).map(row => ({ ...row, id: `p${row.id}` }))
    mount({
      data: page,
      rowCount: 1000,
      dataMode: { pagination: 'server' },
      plugins: [
        rowExpanding({ initialExpanded: true }),
        pagination({ initialPageSize: 25 }),
      ],
    })
    act(() => table.setPageIndex(3))
    const rows = topLevel()
    expect(rows[0]).toMatchObject({ pos: 76, size: 1000 })
    expect(rows.at(-1)).toMatchObject({ pos: 100, size: 1000 })

    act(() => root!.unmount())
    mount({
      data: page,
      rowCount: -1,
      dataMode: { pagination: 'server' },
      plugins: [pagination({ initialPageSize: 25 })],
    })
    expect(topLevel()[0]).toMatchObject({ pos: 1, size: 25 })
    expect(topLevel().at(-1)).toMatchObject({ pos: 25, size: 25 })
  })

  it('SZ4: лента — размер набора строк верхнего уровня — rowCount, без него при hasMore — -1, когда строк больше нет — загруженные; место — среди всех загруженных', () => {
    const data = makeData(40)
    const withLoaded = ({
      hasMore,
      rowCount,
    }: {
      hasMore: boolean
      rowCount?: number
    }) => {
      act(() => root?.unmount())
      mount({
        data,
        rowCount,
        plugins: [
          rowExpanding({ initialExpanded: true }),
          infiniteScroll({ onLoadMore: () => {}, hasMore }),
        ],
      })
      return topLevel()
    }

    const known = withLoaded({ hasMore: true, rowCount: 500 })
    expect(known.at(-1)).toMatchObject({ pos: 40, size: 500 })

    const unknown = withLoaded({ hasMore: true })
    expect(unknown[0]).toMatchObject({ pos: 1, size: -1 })
    expect(unknown.at(-1)).toMatchObject({ pos: 40, size: -1 })

    const ended = withLoaded({ hasMore: false })
    expect(ended.at(-1)).toMatchObject({ pos: 40, size: 40 })
  })
})
