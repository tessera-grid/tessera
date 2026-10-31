// @vitest-environment happy-dom
/**
 * Подсказка виртуализатору — место первого изменения строк (ADR 0145, HV3–HV7): модель
 * раскрытия, лента и серверная модель против полного пересчёта позиций. Размер строки —
 * от её ключа, поэтому неверная подсказка видна по позициям.
 * Запуск: npx vitest run --project unit rowChanges
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readPluginHooks } from '../core/definePlugin'
import {
  firstChangedIndex,
  type RowBuild,
  rowBuildOf,
} from '../core/rowChanges'
import { rowSourceOf } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnFilteringModel,
  columnSortingModel,
  infiniteScroll,
  paginationModel,
  quickSearchModel,
  rowExpanding,
  rowGroupingModel,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import type { RowExpandingHooks } from '../plugins/rowExpanding'
import { toggleRowExpanded } from '../plugins/rowExpanding/toggleRowExpanded'
import {
  type VirtualItem,
  Virtualizer,
} from '../../vendor/tanstack-virtual/virtual-core'

type Key = VirtualItem['key']
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Node {
  id: string
  name: string
  kids?: number
  subRows?: Node[]
}

const node = (id: string, subRows?: Node[], kids = 0): Node => ({
  id,
  name: id,
  kids,
  ...(subRows ? { subRows } : {}),
})
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
]
const TREE: Node[] = [
  node('a', [node('a1'), node('a2', [node('a2x')])]),
  node('b'),
  node('c', [node('c1'), node('c2')]),
  node('d'),
]
const flat = (from: number, count: number) =>
  Array.from({ length: count }, (_, k) => node(`r${from + k}`))

let root: Root | undefined
let table: any
beforeEach(() => vi.stubEnv('NODE_ENV', 'production'))
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

const Grid = (props: {
  data: Node[]
  plugins: () => readonly unknown[]
  rowCount?: number
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: props.data,
    rowCount: props.rowCount,
    getRowId: (row: Node) => row.id,
    plugins: props.plugins() as never,
  })
  return null
}

const render = (
  data: Node[],
  plugins: () => readonly unknown[],
  rowCount?: number,
) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Grid, { data, plugins, rowCount })))
}

/** Размер строки — от её ключа: сдвиг позиций виден, если подсказка дальше изменения. */
const sizeOf = (key: Key) => {
  let hash = 0
  for (const char of String(key)) hash = (hash * 31 + char.charCodeAt(0)) % 97
  return 20 + (hash % 23)
}

/** Ключи и список строк — как у виртуализатора строк грида. */
const keysOf = () => {
  const source = rowSourceOf<{ id: string }>(table)
  const list = source.keyByIndex ? undefined : source.rows?.()
  const key = (index: number): Key =>
    source.keyByIndex
      ? index
      : (list?.[index]?.id ?? source.at(index)?.id ?? index)
  return {
    count: source.count(),
    key,
    list,
    ids: () => idsOf(key, source.count()),
  }
}
const idsOf = (key: (index: number) => Key, count: number) =>
  Array.from({ length: count }, (_, i) => key(i))

const layout = (v: Virtualizer<Element, Element>) => {
  v.getTotalSize()
  return Array.from({ length: v.options.count }, (_, i) => {
    const item = v.measurementsCache[i]!
    return [item.key, item.start, item.size]
  })
}

/**
 * Виртуализатор над строками таблицы с подсказкой грида; `update` — пересборка после
 * смены строк: подсказка, ключи, которые он спросил, и паритет с новым виртуализатором.
 */
const track = () => {
  let keys = keysOf()
  let built: RowBuild | undefined
  let hint: number | undefined
  const asked: number[] = []
  const estimateSize = (index: number) => sizeOf(keys.key(index))
  const options = () => ({
    count: keys.count,
    getScrollElement: () => null,
    estimateSize,
    getItemKey: (index: number) => {
      asked.push(index)
      return keys.key(index)
    },
    getFirstChangedIndex: () => {
      const next = rowBuildOf(table, keys.list)
      const previous = built
      built = next
      hint = previous ? firstChangedIndex(table, previous, next) : undefined
      return hint
    },
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset: () => {},
  })
  const v = new Virtualizer<Element, Element>(options())
  v.getTotalSize()
  let before = keys.ids()
  return () => {
    keys = keysOf()
    asked.length = 0
    v.setOptions(options())
    const updated = layout(v)
    const fresh = new Virtualizer<Element, Element>({
      ...options(),
      getItemKey: keys.key,
      getFirstChangedIndex: undefined,
    })
    const after = keys.ids()
    let truth = 0
    while (
      truth < Math.min(before.length, after.length) &&
      before[truth] === after[truth]
    ) {
      truth++
    }
    const changed = before.join('|') !== after.join('|')
    before = after
    return {
      hint,
      truth,
      changed,
      parity: updated,
      full: layout(fresh),
      askedBefore: (index: number) => asked.some(i => i < index),
    }
  }
}

const toggle = (id: string) =>
  act(() =>
    toggleRowExpanded(
      table.getCoreRowModel().rowsById[id],
      readPluginHooks<Partial<RowExpandingHooks>>(table, 'rowExpanding'),
    ),
  )
const indexOf = (id: string) => rowSourceOf(table).indexOf(id)

describe('Подсказка места изменения строк (ADR 0145)', () => {
  it('HV3: приход ленивых детей — подсказка — первая строка после родителя, позиции совпадают с полным пересчётом', async () => {
    let resolve!: (rows: Node[]) => void
    const data = [node('a', undefined, 2), node('b'), node('c', [node('c1')])]
    render(data, () => [
      rowExpanding({
        initialExpanded: { c: true },
        hasChildren: (row: { original: Node }) => (row.original.kids ?? 0) > 0,
        loadChildren: () =>
          new Promise<Node[]>(done => {
            resolve = done
          }),
      }),
    ])
    const update = track()
    toggle('a')
    update()
    await act(async () => {
      resolve([node('a1'), node('a2')])
      await new Promise(done => setTimeout(done, 50))
    })
    expect(table.getCoreRowModel().rowsById.a.subRows).toHaveLength(2)
    const { hint, truth, parity, full, askedBefore } = update()
    expect(hint).toBe(indexOf('a') + 1)
    expect(hint).toBeLessThanOrEqual(truth)
    expect(askedBefore(hint!)).toBe(false)
    expect(parity).toEqual(full)
  })

  it('HV4: раскрытие и сворачивание кликом — подсказка — первая строка после строки; полная сборка модели раскрытия подсказки не даёт', () => {
    render(TREE, () => [
      rowExpanding({ maxDepth: 3, initialExpanded: { c: true } }),
    ])
    const update = track()
    for (const id of ['a', 'a2', 'a2', 'a']) {
      toggle(id)
      const { hint, truth, parity, full, askedBefore } = update()
      expect(hint, id).toBe(indexOf(id) + 1)
      expect(hint, id).toBeLessThanOrEqual(truth)
      expect(askedBefore(hint!), id).toBe(false)
      expect(parity, id).toEqual(full)
    }
    act(() => table.toggleAllRowsExpanded(true))
    const all = update()
    expect(all.hint).toBeUndefined()
    expect(all.parity).toEqual(all.full)
  })

  it('HV5: лента дописала блок в конец data — подсказка — длина прежнего списка; без ленты, при сортировке, фильтре, поиске, группировке на клиенте и при data не длиннее прежней — подсказки нет', () => {
    const feed = () => infiniteScroll({ hasMore: true, onLoadMore: () => {} })
    const appended = (plugins: () => readonly unknown[]) => {
      const first = flat(0, 50)
      render(first, plugins)
      const update = track()
      render(first.concat(flat(50, 10)), plugins)
      const result = update()
      act(() => root!.unmount())
      root = undefined
      return result
    }

    const fed = appended(() => [feed()])
    expect(fed.hint).toBe(50)
    expect(fed.parity).toEqual(fed.full)
    expect(fed.askedBefore(50)).toBe(false)

    for (const [name, plugins] of [
      ['без ленты', () => []],
      [
        'сортировка',
        () => [
          feed(),
          columnSortingModel({ initialSorting: [{ id: 'name', desc: true }] }),
        ],
      ],
      [
        'фильтр',
        () => [
          feed(),
          columnFilteringModel({
            initialColumnFilters: [
              { id: 'name', value: { operator: 'contains', value: 'r' } },
            ],
          }),
        ],
      ],
      ['поиск', () => [feed(), quickSearchModel({ initialGlobalFilter: 'r' })]],
      [
        'группировка',
        () => [feed(), rowGroupingModel({ initialGrouping: ['name'] })],
      ],
    ] as const) {
      const result = appended(plugins)
      expect(result.hint, name).toBeUndefined()
      expect(result.parity, name).toEqual(result.full)
    }

    const same = flat(0, 50)
    render(same, () => [feed()])
    const update = track()
    render(same.slice(), () => [feed()])
    expect(update().hint).toBeUndefined()
  })

  it('HV6: серверная модель — раскрытие и сворачивание ветки и смена итога: подсказка — прежнее число строк, позиции совпадают с полным пересчётом', async () => {
    const calls: {
      request: ServerRowsRequest
      resolve: (response: ServerRowsResponse<Node>) => void
    }[] = []
    const getRows = (request: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<Node>>(resolve => {
        calls.push({ request, resolve })
      })
    render(
      [],
      () => [
        serverRowModel({ getRows, blockSize: 10 }),
        rowExpanding({
          hasChildren: (row: { depth: number }) => row.depth === 0,
        }),
      ],
      1000,
    )
    const source = () => rowSourceOf(table)
    const answer = async (count?: number) => {
      const { request, resolve } = calls.at(-1)!
      const prefix = request.parentId ? `${request.parentId}.` : 'r'
      const last = count === undefined ? request.end : count
      await act(async () => {
        resolve({
          rows: Array.from({ length: last - request.start }, (_, i) =>
            node(`${prefix}${request.start + i}`),
          ),
          ...(count === undefined ? {} : { rowCount: count }),
        })
      })
    }
    act(() => source().observe!({ first: 0, last: 9, fast: false }))
    await answer()
    const update = track()

    const steps: [string, () => Promise<void>][] = [
      [
        'раскрытие',
        async () => {
          act(() => table.setExpanded({ r1: true }))
          source().count()
          await act(async () => {})
          await answer(5)
        },
      ],
      [
        'сворачивание',
        async () => {
          act(() => table.setExpanded({}))
          source().count()
          await act(async () => {})
        },
      ],
    ]
    for (const [name, step] of steps) {
      const before = source().count()
      await step()
      const { hint, parity, full, askedBefore } = update()
      expect(source().count(), name).not.toBe(before)
      expect(Math.min(hint!, before), name).toBe(
        Math.min(before, source().count()),
      )
      expect(askedBefore(Math.min(before, source().count())), name).toBe(false)
      expect(parity, name).toEqual(full)
    }

    act(() => source().observe!({ first: 990, last: 999, fast: false }))
    await answer(995)
    const total = update()
    expect(source().count()).toBe(995)
    expect(total.askedBefore(995)).toBe(false)
    expect(total.parity).toEqual(total.full)
  })

  it('HV7: сортировка, фильтр, поиск, замена data, пагинация — позиции совпадают с полным пересчётом, подсказки нет или она из сборки модели раскрытия', () => {
    render(TREE, () => [
      rowExpanding({ maxDepth: 3, initialExpanded: { a: true, c: true } }),
      columnSortingModel(),
      columnFilteringModel(),
      quickSearchModel(),
    ])
    const update = track()
    for (const [name, change] of [
      ['сортировка', () => table.setSorting([{ id: 'name', desc: true }])],
      [
        'фильтр',
        () =>
          table.setColumnFilters([
            { id: 'name', value: { operator: 'contains', value: 'c' } },
          ]),
      ],
      ['поиск', () => table.setGlobalFilter('a')],
      [
        'снятие',
        () => {
          table.setColumnFilters([])
          table.setGlobalFilter('')
        },
      ],
    ] as const) {
      act(change)
      const { hint, parity, full, changed } = update()
      expect(changed, name).toBe(true)
      expect(hint, name).toBeUndefined()
      expect(parity, name).toEqual(full)
    }
    // Между сборками — полная сборка и сборка из прошлой: журнал не доходит до прошлой
    // сборки виртуализатора.
    act(() => table.setSorting([]))
    // Отрисовка читает строки: модель собрана после сортировки.
    rowSourceOf(table).count()
    toggle('c')
    const chain = update()
    expect(chain.changed).toBe(true)
    expect(chain.hint).toBeUndefined()
    expect(chain.parity).toEqual(chain.full)
    act(() => root!.unmount())
    root = undefined

    const plugins = () => [
      rowExpanding({ maxDepth: 3, initialExpanded: { c: true } }),
    ]
    render(TREE, plugins)
    const replaced = track()
    render(TREE.map(row => ({ ...row })).reverse(), plugins)
    const data = replaced()
    expect(data.changed).toBe(true)
    expect(data.hint).toBeUndefined()
    expect(data.parity).toEqual(data.full)
    act(() => root!.unmount())
    root = undefined

    render(TREE, () => [
      rowExpanding({ maxDepth: 3, initialExpanded: { c: true } }),
      paginationModel({ initialPageSize: 3 }),
    ])
    const paged = track()
    toggle('a')
    const page = paged()
    expect(page.changed).toBe(true)
    expect(page.hint).toBeUndefined()
    expect(page.parity).toEqual(page.full)
  })
})
