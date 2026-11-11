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
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
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
  let kept: number[] | undefined
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
      const answer = previous
        ? firstChangedIndex(table, previous, next)
        : undefined
      hint = typeof answer === 'object' ? answer.from : answer
      kept = typeof answer === 'object' ? answer.kept : undefined
      return answer
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
      kept,
      asked: [...asked],
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

  it('HV5: лента дописала блок в конец data — подсказка — длина прежнего списка; без ленты, при сортировке, фильтре, поиске, группировке на клиенте — подсказка модели строк; data в другом порядке — подсказки нет; позиции совпадают с полным пересчётом', () => {
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
      // Модель собрана из прошлой (ADR 0194): место изменения знает она, а не опция ленты.
      const result = appended(plugins)
      expect(result.hint, name).toBeDefined()
      expect(result.parity, name).toEqual(result.full)
    }

    const same = flat(0, 50)
    render(same, () => [feed()])
    const update = track()
    // Та же длина в другом порядке: модель собрана заново, место изменения неизвестно.
    render(same.slice().reverse(), () => [feed()])
    const reversed = update()
    expect(reversed.hint).toBeUndefined()
    expect(reversed.parity).toEqual(reversed.full)
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

describe('Подсказка при смене data (ADR 0194)', () => {
  it('IU10: смена data из прежней модели даёт виртуализатору место первого изменения без полного пересчёта — без плагинов, при сортировке, фильтре, группировке и раскрытии; позиции совпадают с полным пересчётом', () => {
    // Дерево — только для раскрытия: группировка дерева идёт полной сборкой.
    const rowsOf = (tree: boolean): Node[] =>
      flat(0, 200).map((row, i) => ({
        ...row,
        kids: i % 3,
        ...(tree && i % 20 === 0
          ? { subRows: [node(`r${i}.a`), node(`r${i}.b`)] }
          : {}),
      }))
    const steps: [string, (d: Node[]) => Node[]][] = [
      [
        'замена',
        d =>
          d.map((row, i) =>
            i === 120 ? { ...row, name: 'r120*', kids: 2 } : row,
          ),
      ],
      ['вставка', d => [...d.slice(0, 150), node('x1'), ...d.slice(150)]],
      ['удаление', d => d.filter((_, i) => i !== 170)],
    ]
    for (const [name, plugins] of [
      ['без плагинов', () => []],
      [
        'сортировка',
        () => [
          columnSortingModel({ initialSorting: [{ id: 'name', desc: false }] }),
        ],
      ],
      [
        'фильтр',
        () => [
          columnFilteringModel({
            initialColumnFilters: [
              { id: 'name', value: { operator: 'contains', value: 'r' } },
            ],
          }),
        ],
      ],
      [
        'группировка',
        () => [
          rowGroupingModel({ initialGrouping: ['name'] }),
          rowExpanding({ initialExpanded: true }),
        ],
      ],
      [
        'раскрытие',
        () => [rowExpanding({ initialExpanded: { r100: true, r160: true } })],
      ],
    ] as const) {
      let data = rowsOf(name === 'раскрытие')
      render(data, plugins)
      const update = track()
      for (const [label, step] of steps) {
        data = step(data)
        render(data, plugins)
        const result = update()
        expect(result.hint, `${name}, ${label}`).toBeDefined()
        expect(result.hint, `${name}, ${label}`).toBeGreaterThan(0)
        expect(result.askedBefore(result.hint!), `${name}, ${label}`).toBe(
          false,
        )
        expect(result.parity, `${name}, ${label}`).toEqual(result.full)
      }
      act(() => root!.unmount())
      root = undefined
    }
  })
})

describe('Пересчёт позиций сдвигом (ADR 0210)', () => {
  /** Имена с повторами: при сортировке строки середины `data` разбросаны по списку. */
  const named = (from: number, count: number): Node[] =>
    flat(from, count).map((row, k) => ({ ...row, name: `n${(from + k) % 7}` }))
  const sorted = () => [
    columnSortingModel({ initialSorting: [{ id: 'name', desc: false }] }),
  ]
  /** Ни одного спрошенного ключа внутри отрезков прежних строк. */
  const outsideRuns = (kept: number[], asked: number[]) =>
    asked.every(index => {
      for (let r = 0; r < kept.length; r += 3) {
        if (index >= kept[r]! && index < kept[r]! + kept[r + 2]!) return false
      }
      return true
    })

  it('VS3: смена data транзакцией при сортировке даёт отрезки прежних строк — разбросанные удаления, вставка, перенос, цепочка из нескольких смен; позиции совпадают с полным пересчётом', () => {
    let data = named(0, 1000)
    render(data, sorted)
    const update = track()
    const steps: [string, (d: Node[]) => Node[], number][] = [
      ['удаление', d => d.filter((_, i) => i < 500 || i >= 510), 0],
      [
        'вставка',
        d => [...d.slice(0, 300), ...named(5000, 10), ...d.slice(300)],
        10,
      ],
      [
        'перенос',
        d => {
          const next = d.slice()
          const [row] = next.splice(10, 1)
          next.splice(600, 0, row!)
          return next
        },
        1,
      ],
    ]
    for (const [label, step, fresh] of steps) {
      data = step(data)
      render(data, sorted)
      const result = update()
      expect(result.kept, label).toBeDefined()
      expect(result.parity, label).toEqual(result.full)
      expect(result.asked, label).toHaveLength(fresh)
      expect(outsideRuns(result.kept!, result.asked), label).toBe(true)
    }
    // Две смены между сборками виртуализатора: отрезки — по наборам обеих.
    data = data.filter((_, i) => i % 100 !== 5)
    render(data, sorted)
    data = [...named(6000, 3), ...data]
    render(data, sorted)
    const chain = update()
    expect(chain.kept).toBeDefined()
    expect(chain.parity).toEqual(chain.full)
    expect(chain.asked).toHaveLength(3)
  })

  it('VS4: раскрытие и сворачивание кликом — отрезок общего конца списков; позиции совпадают с полным пересчётом', () => {
    const data = flat(0, 200).map((row, i) =>
      i % 20 === 0
        ? { ...row, subRows: [node(`r${i}.a`), node(`r${i}.b`)] }
        : row,
    )
    render(data, () => [rowExpanding({ initialExpanded: { r0: true } })])
    const update = track()
    for (const [id, fresh] of [
      ['r40', 2],
      ['r40', 0],
    ] as const) {
      toggle(id)
      const result = update()
      expect(result.kept, id).toBeDefined()
      expect(result.parity, id).toEqual(result.full)
      expect(result.asked, id).toHaveLength(fresh)
      expect(outsideRuns(result.kept!, result.asked), id).toBe(true)
    }
  })
})
