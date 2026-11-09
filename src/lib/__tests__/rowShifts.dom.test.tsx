// @vitest-environment happy-dom
/**
 * Вставка, удаление и перенос в середине `data` (ADR 0199; MS2–MS4, MS6–MS8): сдвинутые строки —
 * прежние объекты, их место знает хранилище (ADR 0200, §5), перенесённые — новые объекты, итог
 * моделей — как у полной сборки.
 * Запуск: npx vitest run --config vitest.node.config.ts rowShifts
 */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { rowModelChangeOf } from '../core/dataChanges'
import { firstChangeSince } from '../core/rowChanges'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnFilteringModel,
  columnSortingModel,
  quickSearchModel,
  rowExpanding,
  rowGroupingModel,
} from '../plugins'
import { positionOf } from '../core/rowPosition'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  score?: number
  subRows?: Item[]
}

interface ModelRow {
  id: string
  index: number
  depth: number
  original: unknown
  parentId?: string
  subRows: ModelRow[]
  getValue: (columnId: string) => unknown
}
interface Model {
  rows: ModelRow[]
  flatRows: ModelRow[]
  rowsById: Record<string, ModelRow>
}

const make = (count: number, kidsEvery = 0): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: `n${i}`,
    score: i % 7,
    ...(kidsEvery && i % kidsEvery === 0
      ? {
          subRows: [0, 1, 2, 3].map(k => ({
            id: `r${i}.${k}`,
            name: `n${i}.${k}`,
            score: (i + k) % 3,
          })),
        }
      : {}),
  }))

const COLUMNS = [
  { id: 'name', accessorKey: 'name' },
  { id: 'score', accessorKey: 'score', aggregationFn: 'sum' },
  { id: 'grp', accessorFn: (row: Item) => `g${row.score}` },
]

/** Устройство модели для сравнения с полной сборкой. */
const shape = (model: Model) => {
  const row = (r: ModelRow): unknown => ({
    id: r.id,
    index: positionOf(r),
    depth: r.depth,
    parentId: r.parentId,
    original: r.original,
    subRows: r.subRows.map(row),
  })
  return {
    rows: model.rows.map(row),
    flat: model.flatRows.map(r => r.id),
    byId: Object.keys(model.rowsById).sort(),
    consistent: model.flatRows.every(r => model.rowsById[r.id] === r),
  }
}

let roots: Root[] = []
afterEach(() => {
  for (const root of roots) act(() => root.unmount())
  roots = []
})

interface HostOptions {
  plugins?: () => unknown[]
  columns?: unknown[]
  read?: (table: any) => Model
}

const coreModel = (table: any): Model => table.getCoreRowModel()

/** Таблица на данных с перерисовкой по `setData`; транзакции пишут в те же данные. */
const host = (
  initial: Item[],
  { plugins = () => [], columns = COLUMNS, read = coreModel }: HostOptions = {},
) => {
  let table: any
  let current = initial
  let setData: (next: Item[]) => void = () => {}
  const Host = ({ seed }: { seed: Item[] }) => {
    const [data, set] = useState(seed)
    const [entries] = useState(plugins)
    current = data
    setData = set
    table = useCreateTable({
      columns: columns as never,
      data,
      getRowId: (row: Item) => row.id,
      onDataChange: (next: Item[]) => set(next),
      plugins: entries as never,
    } as never)
    return null
  }
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  act(() => root.render(createElement(Host, { seed: initial })))
  read(table)
  return {
    model: (): Model => read(table),
    table: () => table,
    data: () => current,
    set: (next: Item[]) => {
      act(() => setData(next))
      read(table)
    },
    transaction: (transaction: object) => {
      act(() => {
        table.applyRowTransaction(transaction)
      })
      read(table)
    },
  }
}

const fullBuild = (data: Item[], options: HostOptions = {}) =>
  host(data, options).model()

const insertAt = (at: number, items: Item[]) => (d: Item[]) => [
  ...d.slice(0, at),
  ...items,
  ...d.slice(at),
]
const removeAt = (from: number, count: number) => (d: Item[]) => [
  ...d.slice(0, from),
  ...d.slice(from + count),
]
const moveRow = (from: number, to: number) => (d: Item[]) => {
  const next = d.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

describe('Сдвиги в середине data (ADR 0199)', () => {
  it('MS2: вставка и удаление в середине — новым data и транзакцией по id — прежние объекты с новым местом у хранилища', () => {
    const grid = host(make(2000))
    const kept = grid.model().rowsById['r1500']!
    grid.set(
      insertAt(1000, [
        { id: 'x1', name: 'x1', score: 1 },
        { id: 'x2', name: 'x2', score: 2 },
      ])(grid.data()),
    )
    expect(grid.model().rowsById['r1500']).toBe(kept)
    expect(kept.index).toBe(1500)
    expect(positionOf(kept)).toBe(1502)
    expect(shape(grid.model())).toEqual(shape(fullBuild(grid.data())))
    grid.set(grid.data().filter(item => !item.id.startsWith('x')))
    grid.set(removeAt(700, 3)(grid.data()))
    expect(grid.model().rowsById['r1500']).toBe(kept)
    expect(positionOf(kept)).toBe(1497)
    expect(shape(grid.model())).toEqual(shape(fullBuild(grid.data())))

    grid.transaction({ remove: ['r800', 'r801', 'r1999'] })
    const model = grid.model()
    expect(grid.data().some(item => item.id === 'r800')).toBe(false)
    expect(rowModelChangeOf(model)?.removed).toEqual(
      new Set(['r800', 'r801', 'r1999']),
    )
    expect(model.rowsById['r1500']).toBe(kept)
    expect(positionOf(kept)).toBe(1495)
    expect(shape(model)).toEqual(shape(fullBuild(grid.data())))
  })

  it('MS3: перенос — перенесённые новые объекты и изменённые в смене, прочие прежние; перестановка сверх порога — полная сборка', () => {
    const grid = host(make(2000))
    const before = grid.model()
    const moved = before.rowsById['r10']!
    const between = before.rowsById['r11']!
    grid.set(moveRow(10, 1500)(grid.data()))
    const model = grid.model()
    const change = rowModelChangeOf(model)!
    expect(change.changed).toEqual(new Set(['r10']))
    expect(model.rowsById['r10']).not.toBe(moved)
    expect(positionOf(model.rowsById['r10']!)).toBe(1500)
    expect(model.rowsById['r11']).toBe(between)
    expect(positionOf(between)).toBe(10)
    expect(shape(model)).toEqual(shape(fullBuild(grid.data())))

    // Обратно издалека и несколько переносов за раз.
    grid.set(moveRow(1900, 5)(grid.data()))
    grid.set(moveRow(30, 40)(moveRow(600, 20)(grid.data())))
    expect(rowModelChangeOf(grid.model())).toBeDefined()
    expect(shape(grid.model())).toEqual(shape(fullBuild(grid.data())))

    // Половина строк в обратном порядке — сверх порога: полная сборка.
    grid.set([
      ...grid.data().slice(0, 1000).reverse(),
      ...grid.data().slice(1000),
    ])
    expect(rowModelChangeOf(grid.model())).toBeUndefined()
    expect(shape(grid.model())).toEqual(shape(fullBuild(grid.data())))
  })

  it('MS4: сортировка, фильтры с поиском, группировка и раскрытие после вставки, удаления и переноса совпадают с полной сборкой; сортировка читает значения только изменённых строк', () => {
    let reads = 0
    const columns = [
      ...COLUMNS.filter(column => column.id !== 'score'),
      {
        id: 'score',
        accessorFn: (row: Item) => {
          reads++
          return row.score
        },
        aggregationFn: 'sum',
      },
    ]
    const steps: ((d: Item[]) => Item[])[] = [
      insertAt(700, [
        { id: 'x1', name: 'x1', score: 3 },
        { id: 'x2', name: 'x21', score: 3 },
      ]),
      removeAt(300, 4),
      moveRow(10, 1500),
      moveRow(1800, 3),
    ]
    const setups: [string, () => unknown[], (table: any) => Model][] = [
      [
        'сортировка',
        () => [
          columnSortingModel({
            initialSorting: [{ id: 'score', desc: false }],
          }),
        ],
        table => table.getSortedRowModel(),
      ],
      [
        'фильтр и поиск',
        () => [
          columnFilteringModel({
            initialColumnFilters: [
              { id: 'name', value: { operator: 'contains', value: '1' } },
            ],
          }),
          quickSearchModel({ initialGlobalFilter: '2' }),
        ],
        table => table.getFilteredRowModel(),
      ],
      [
        'группировка',
        () => [rowGroupingModel({ initialGrouping: ['grp'] })],
        table => table.getGroupedRowModel(),
      ],
      [
        'группировка, сортировка и раскрытие',
        () => [
          rowGroupingModel({ initialGrouping: ['grp'] }),
          columnSortingModel({ initialSorting: [{ id: 'score', desc: true }] }),
          rowExpanding({ initialExpanded: { 'grp:g1': true, 'grp:g3': true } }),
        ],
        table => table.getRowModel(),
      ],
    ]
    for (const [name, plugins, read] of setups) {
      const options = { columns, plugins, read }
      const grid = host(make(2000), options)
      for (const [n, step] of steps.entries()) {
        reads = 0
        grid.set(step(grid.data()))
        if (name === 'сортировка') {
          expect(
            rowModelChangeOf(grid.model()),
            `${name}, шаг ${n}`,
          ).toBeDefined()
          expect(reads, `${name}: чтения значений, шаг ${n}`).toBeLessThan(50)
        }
        expect(shape(grid.model()), `${name}, шаг ${n}`).toEqual(
          shape(fullBuild(grid.data(), options)),
        )
      }
    }
  })

  it('MS6: вставка, удаление и перенос внутри ветки — прежние объекты детей с новым местом у хранилища, итог как у полной сборки', () => {
    const grid = host(make(300, 10))
    const kid = grid.model().rowsById['r20.3']!
    grid.transaction({
      parentId: 'r20',
      add: [{ id: 'k1', name: 'k1', score: 1 }],
      index: 1,
    })
    expect(grid.model().rowsById['r20.3']).toBe(kid)
    expect(positionOf(kid)).toBe(4)
    expect(shape(grid.model())).toEqual(shape(fullBuild(grid.data())))

    grid.transaction({ parentId: 'r20', remove: ['r20.0'] })
    expect(grid.model().rowsById['r20.3']).toBe(kid)
    expect(positionOf(kid)).toBe(3)
    expect(shape(grid.model())).toEqual(shape(fullBuild(grid.data())))

    // Перенос ребёнка внутри ветки — новый `subRows` ветки.
    grid.set(
      grid
        .data()
        .map(item =>
          item.id === 'r30'
            ? { ...item, subRows: moveRow(0, 3)(item.subRows!) }
            : item,
        ),
    )
    expect(shape(grid.model())).toEqual(shape(fullBuild(grid.data())))
  })

  it('MS7: прежняя модель после сдвига — те же массивы и порядок; меняются только места сдвинутых строк, значение колонки от индекса — по месту при создании', () => {
    const columns = [
      ...COLUMNS,
      { id: 'place', accessorFn: (_row: Item, index: number) => index },
    ]
    const grid = host(make(1000), { columns })
    const before = grid.model()
    const rows = before.rows
    const order = rows.map(row => row.id)
    const flat = before.flatRows
    const ids = Object.keys(before.rowsById).sort()
    before.rows[900]!.getValue('place')
    grid.set(insertAt(500, [{ id: 'x1', name: 'x1', score: 1 }])(grid.data()))
    expect(before.rows).toBe(rows)
    expect(before.rows.map(row => row.id)).toEqual(order)
    expect(before.flatRows).toBe(flat)
    expect(Object.keys(before.rowsById).sort()).toEqual(ids)
    expect(positionOf(before.rows[900]!)).toBe(901)
    expect(before.rows[900]!.getValue('place')).toBe(900)
    expect(positionOf(before.rows[100]!)).toBe(100)
  })

  it('MS8: виртуализатор получает подсказкой место первого сдвига', () => {
    const options = {
      plugins: () => [
        columnSortingModel({ initialSorting: [{ id: 'name', desc: false }] }),
      ],
    }
    for (const read of [coreModel, (table: any) => table.getRowModel()]) {
      const grid = host(make(1000), { ...options, read })
      const steps: [(d: Item[]) => Item[], (model: Model) => number][] = [
        [insertAt(400, [{ id: 'x1', name: 'n400a' }]), () => -1],
        [removeAt(600, 2), () => -1],
        [moveRow(700, 200), () => -1],
      ]
      for (const [step] of steps) {
        const prev = grid.model()
        const prevRows = prev.rows
        grid.set(step(grid.data()))
        const rows = grid.model().rows
        let first = 0
        while (first < rows.length && rows[first] === prevRows[first]) first++
        expect(firstChangeSince(rows, prevRows)).toBe(first)
      }
    }
  })
})
