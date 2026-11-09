// @vitest-environment happy-dom
/**
 * Смена `data` по тождеству строк (ADR 0194; IU1–IU4, IU9): модель ядра из прежней совпадает
 * с полной сборкой TanStack, нетронутые строки — прежние объекты, без `getRowId` инкремент
 * только у замены на месте, перестановка — полная сборка, автосбросы как у полной сборки.
 * Запуск: npx vitest run --config vitest.node.config.ts dataChanges
 */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { rowModelChangeOf } from '../core/dataChanges'
import { firstChangeSince } from '../core/rowChanges'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellSelectionModel,
  columnFilteringModel,
  columnSortingModel,
  quickSearchModel,
  rowExpanding,
  rowGroupingModel,
} from '../plugins'
import { positionOf } from '../core/rowPosition'
import { childrenOf } from '../core/rowEngine/displayChildren'
import { engineOf } from '../core/rowEngine/engine'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  score?: number
  kids?: Item[]
}

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]

const make = (count: number, kidsEvery = 0): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: `n${i}`,
    score: i % 7,
    ...(kidsEvery && i % kidsEvery === 0
      ? {
          kids: [0, 1, 2].map(k => ({
            id: `r${i}.${k}`,
            name: `n${i}.${k}`,
            score: (i + k) % 2,
          })),
        }
      : {}),
  }))

interface ModelRow {
  id: string
  index: number
  depth: number
  original: unknown
  parentId?: string
  subRows: ModelRow[]
}
interface Model {
  rows: ModelRow[]
  flatRows: ModelRow[]
  rowsById: Record<string, ModelRow>
}

/** Устройство модели для сравнения с полной сборкой. */
const shape = (model: Model) => {
  // Дети — в порядке показа: у выхода стадии движка — дети показа (ADR 0200, §4).
  const row = (r: ModelRow): unknown => ({
    id: r.id,
    index: positionOf(r),
    depth: r.depth,
    parentId: r.parentId,
    original: r.original,
    subRows: childrenOf(model, r).map(row),
  })
  return {
    rows: model.rows.map(row),
    flat: model.flatRows.map(r => r.id),
    byId: Object.keys(model.rowsById)
      .sort()
      .map(id => [id, model.rowsById[id]!.id]),
    consistent: model.flatRows.every(r => model.rowsById[r.id] === r),
  }
}

let roots: Root[] = []
afterEach(() => {
  for (const root of roots) act(() => root.unmount())
  roots = []
})

interface HostOptions {
  rowId?: boolean
  plugins?: unknown[]
  columns?: unknown[]
  /** Модель, которую читает тест; строится на каждый рендер, как у грида. */
  read?: (table: any) => Model
}

const coreModel = (table: any): Model => table.getCoreRowModel()

/** Таблица на данных с перерисовкой по `setData`; `getRowId`, плагины и модель — по желанию. */
const host = (
  initial: Item[],
  {
    rowId = true,
    plugins = [],
    columns = COLUMNS,
    read = coreModel,
  }: HostOptions = {},
) => {
  let table: any
  let setData: (next: Item[]) => void = () => {}
  const Host = ({ seed }: { seed: Item[] }) => {
    const [data, set] = useState(seed)
    setData = set
    table = useCreateTable({
      columns: columns as never,
      data,
      ...(rowId ? { getRowId: (row: Item) => row.id } : {}),
      getSubRows: (row: Item) => row.kids,
      plugins: plugins as never,
    } as never)
    return null
  }
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  act(() => root.render(createElement(Host, { seed: initial })))
  // Модель строится на каждый рендер грида: прежняя модель есть до смены data.
  read(table)
  return {
    model: (): Model => read(table),
    table: () => table,
    set: (next: Item[]) => {
      act(() => setData(next))
      read(table)
    },
  }
}

/** Полная сборка TanStack на тех же данных — в свежей таблице. */
const fullBuild = (data: Item[], options: HostOptions = {}) =>
  host(data, options).model()

/** Плоские данные без сдвигов: замена на месте и дописывание в конец. */
const FLAT_STEPS: ((d: Item[]) => Item[])[] = [
  d =>
    d.map((item, i) => (i === 3 ? { ...item, score: 5, name: 'n13' } : item)),
  d =>
    d.map((item, i) =>
      i === 700 || i === 1200 ? { ...item, score: 3, name: 'q' } : item,
    ),
  d => [
    ...d,
    { id: 'x1', name: 'x12', score: 3 },
    { id: 'x2', name: 'x2', score: 0 },
  ],
  d => d.map((item, i) => (i === 10 ? { ...item, name: 'n10 n12' } : item)),
]

/** Шаги на плоских данных: модель — из прежней без сдвигов, итог — как у полной сборки. */
const checkFlat = (
  options: HostOptions,
  reads: () => number,
  resetReads: () => void,
  label: string,
) => {
  let data = make(2000)
  const grid = host(data, options)
  for (const [n, step] of FLAT_STEPS.entries()) {
    data = step(data)
    resetReads()
    grid.set(data)
    const model = grid.model()
    expect(
      rowModelChangeOf(model)?.inPlace,
      `${label}: без сдвигов, шаг ${n}`,
    ).toBe(true)
    expect(reads(), `${label}: чтения значений, шаг ${n}`).toBeLessThan(100)
    expect(shape(model), `${label}, шаг ${n}`).toEqual(
      shape(fullBuild(data, options)),
    )
  }
}

const replaceAt = (data: Item[], at: number) =>
  data.map((item, i) => (i === at ? { ...item, name: `${item.name}*` } : item))

describe('Смена data по тождеству строк (ADR 0194)', () => {
  it('IU1: замена, вставка и удаление строк и строк поддерева дают модель ядра, совпадающую с полной сборкой TanStack', () => {
    // Колонка с индексом: её значение — по индексу при создании строки (ADR 0200, §5).
    const columns = [
      ...COLUMNS,
      { id: 'pos', accessorFn: (_row: Item, index: number) => index },
    ]
    const values = (model: Model) =>
      model.flatRows.map(row => [row.id, (row as any).getValue('name')])
    let data = make(40, 5)
    const grid = host(data, { columns })
    values(grid.model())
    const steps: ((d: Item[]) => Item[])[] = [
      d => replaceAt(d, 3),
      d => [...d.slice(0, 7), { id: 'x1', name: 'x1' }, ...d.slice(7)],
      d => d.filter((_, i) => i !== 12),
      d => [...d, { id: 'x2', name: 'x2', kids: [{ id: 'x2.0', name: 'k' }] }],
      // Поддерево: у строки 10 сменился ребёнок, сама строка — новым объектом.
      d =>
        d.map(item =>
          item.id === 'r10'
            ? {
                ...item,
                kids: item.kids!.map((kid, k) =>
                  k === 1 ? { ...kid, name: 'kid*' } : kid,
                ),
              }
            : item,
        ),
      d =>
        d.map(item =>
          item.id === 'r15'
            ? { ...item, kids: [...item.kids!, { id: 'r15.9', name: 'new' }] }
            : item,
        ),
      d => d.slice(1),
    ]
    for (const [n, step] of steps.entries()) {
      data = step(data)
      grid.set(data)
      const model = grid.model()
      expect(rowModelChangeOf(model), `инкремент, шаг ${n}`).toBeDefined()
      expect(shape(model)).toEqual(shape(fullBuild(data)))
      expect(values(model)).toEqual(values(fullBuild(data, { columns })))
    }
  })

  it('IU2: строки с прежним объектом данных на прежнем месте — прежние объекты строк; прежняя модель не меняется', () => {
    let data = make(30, 6)
    const grid = host(data)
    const before = grid.model()
    const snapshot = shape(before)
    data = replaceAt(data, 4)
    grid.set(data)
    const after = grid.model()
    expect(after).not.toBe(before)
    for (let i = 0; i < data.length; i++) {
      if (i === 4) {
        expect(after.rows[i]).not.toBe(before.rows[i])
      } else {
        expect(after.rows[i]).toBe(before.rows[i])
      }
    }
    expect(after.rowsById['r6.1']).toBe(before.rowsById['r6.1'])
    expect(shape(before)).toEqual(snapshot)
    const change = rowModelChangeOf(after)!
    expect([...change.changed]).toEqual(['r4'])
    // Прежнюю модель запись отпускает после прохода конвейера (ADR 0200, EN26).
    expect(change.inserted.size + change.removed.size).toBe(0)
  })

  it('IU3: изменения находятся по ссылкам и id строк — getRowId или поле id; повторяющийся id на уровне — полная сборка с тем же итогом', () => {
    // Без getRowId — id из поля строки (умолчание Tessera): вставка идёт инкрементом.
    let data = make(20)
    const grid = host(data, { rowId: false })
    data = [{ id: 'x', name: 'x' }, ...replaceAt(data, 2)]
    grid.set(data)
    expect(rowModelChangeOf(grid.model())).toBeDefined()
    expect(shape(grid.model())).toEqual(
      shape(fullBuild(data, { rowId: false })),
    )
    // Два одинаковых id на уровне — связать строки нельзя.
    data = [...data, { id: 'r3', name: 'twin' }]
    grid.set(data)
    expect(rowModelChangeOf(grid.model())).toBeUndefined()
    expect(shape(grid.model())).toEqual(
      shape(fullBuild(data, { rowId: false })),
    )
  })

  it('IU4: перестановка строк или изменений больше порога — полная сборка с тем же итогом', () => {
    let data = make(40)
    const grid = host(data)
    data = [...data].reverse()
    grid.set(data)
    expect(rowModelChangeOf(grid.model())).toBeUndefined()
    expect(shape(grid.model())).toEqual(shape(fullBuild(data)))
    data = data.map((item, i) => (i % 2 ? { ...item, name: '*' } : item))
    grid.set(data)
    expect(rowModelChangeOf(grid.model())).toBeUndefined()
    expect(shape(grid.model())).toEqual(shape(fullBuild(data)))
  })

  it('IU5: сортировка перекладывает только изменённые, вставленные и удалённые строки; итог и порядок равных — как у полной сортировки', () => {
    let reads = 0
    const columns = [
      ...COLUMNS,
      {
        id: 'score',
        accessorFn: (row: Item) => {
          reads++
          return row.score
        },
      },
    ]
    for (const desc of [false, true]) {
      const options: HostOptions = {
        columns,
        plugins: [
          columnSortingModel({ initialSorting: [{ id: 'score', desc }] }),
        ],
        read: table => engineOf(table).output('sort') as Model,
      }
      let data = make(2000, 50)
      const grid = host(data, options)
      const steps: ((d: Item[]) => Item[])[] = [
        d => d.map((item, i) => (i === 3 ? { ...item, score: 5 } : item)),
        // Вставка с тем же значением, что у соседей: порядок равных — по индексу.
        d => [
          ...d.slice(0, 700),
          { id: 'x1', name: 'x1', score: 3 },
          ...d.slice(700),
        ],
        d => d.filter((_, i) => i !== 12 && i !== 1500),
        // Ребёнок строки поменял значение: перекладка внутри поддерева.
        d =>
          d.map(item =>
            item.id === 'r100'
              ? {
                  ...item,
                  kids: item.kids!.map((kid, k) =>
                    k === 0 ? { ...kid, score: 9 } : kid,
                  ),
                }
              : item,
          ),
        d => [
          {
            id: 'x2',
            name: 'x2',
            score: 6,
            kids: [
              { id: 'x2.0', name: 'k', score: 0 },
              { id: 'x2.1', name: 'k', score: -1 },
            ],
          },
          ...d,
        ],
      ]
      for (const [n, step] of steps.entries()) {
        data = step(data)
        reads = 0
        grid.set(data)
        const model = grid.model()
        expect(rowModelChangeOf(model), `инкремент, шаг ${n}`).toBeDefined()
        expect(reads, `чтения значений, шаг ${n}`).toBeLessThan(100)
        expect(shape(model)).toEqual(shape(fullBuild(data, options)))
      }
      checkFlat(
        options,
        () => reads,
        () => (reads = 0),
        desc ? 'по убыванию' : 'по возрастанию',
      )
    }
  })

  it('IU6: фильтры колонок и быстрый поиск перепроверяют только изменённые и вставленные строки; итог совпадает с полным проходом', () => {
    let reads = 0
    const counted =
      (key: 'name' | 'score') =>
      (row: Item): unknown => {
        reads++
        return row[key]
      }
    const columns = [
      { id: 'name', accessorFn: counted('name') },
      { id: 'score', accessorFn: counted('score') },
    ]
    const filter = () =>
      columnFilteringModel({
        initialColumnFilters: [
          { id: 'name', value: { operator: 'contains', value: '1' } },
        ],
      })
    const search = () => quickSearchModel({ initialGlobalFilter: '2' })
    const sorting = () =>
      columnSortingModel({ initialSorting: [{ id: 'score', desc: true }] })
    const rename = (id: string, name: string) => (d: Item[]) =>
      d.map(item => (item.id === id ? { ...item, name } : item))
    const steps: ((d: Item[]) => Item[])[] = [
      // Строка выходит из отбора и входит в него.
      rename('r10', 'q'),
      rename('r3', 'n13 n23'),
      d => [
        ...d.slice(0, 700),
        { id: 'x1', name: 'x12', score: 3 },
        { id: 'x9', name: 'x9', score: 3 },
        ...d.slice(700),
      ],
      d => d.filter((_, i) => i !== 12 && i !== 1500),
      d =>
        d.map(item =>
          item.id === 'r1200'
            ? {
                ...item,
                kids: item.kids!.map((kid, k) =>
                  k === 0 ? { ...kid, name: 'q', score: 9 } : kid,
                ),
              }
            : item,
        ),
      d => [
        {
          id: 'x2',
          name: 'x12',
          score: 6,
          kids: [
            { id: 'x2.0', name: 'k12', score: 0 },
            { id: 'x2.1', name: 'k', score: -1 },
          ],
        },
        ...d,
      ],
    ]
    for (const [name, plugins, read] of [
      ['фильтр', () => [filter()], 'getFilteredRowModel'],
      ['поиск', () => [search()], 'getFilteredRowModel'],
      [
        'фильтр, поиск и сортировка',
        () => [filter(), search(), sorting()],
        'getRowModel',
      ],
    ] as const) {
      const options: HostOptions = {
        columns,
        plugins: plugins(),
        read: table => table[read](),
      }
      let data = make(2000, 50)
      const grid = host(data, options)
      for (const [n, step] of steps.entries()) {
        data = step(data)
        reads = 0
        grid.set(data)
        const model = grid.model()
        expect(reads, `${name}: чтения значений, шаг ${n}`).toBeLessThan(100)
        expect(shape(model), `${name}, шаг ${n}`).toEqual(
          shape(fullBuild(data, options)),
        )
      }
      checkFlat(
        options,
        () => reads,
        () => (reads = 0),
        name,
      )
    }
  })

  it('IU7: группировка — строка переезжает между группами, пустая группа уходит, новая появляется; агрегаты пересчитываются только у затронутых групп; итог совпадает с полной группировкой', () => {
    let reads = 0
    const columns = [
      ...COLUMNS,
      {
        id: 'score',
        accessorFn: (row: Item) => {
          reads++
          return row.score
        },
        aggregationFn: 'sum',
      },
      {
        id: 'grp',
        accessorFn: (row: Item) => {
          reads++
          return `g${row.score}`
        },
      },
    ]
    const groupOf = (model: Model) =>
      Object.fromEntries(model.rows.map(group => [group.id, group]))
    const totals = (model: Model) =>
      model.flatRows
        .filter(row => row.subRows.length)
        .map(row => [row.id, (row as any).getValue('score')])
    const setScore = (id: string, score: number) => (d: Item[]) =>
      d.map(item => (item.id === id ? { ...item, score } : item))
    const steps: {
      step: (d: Item[]) => Item[]
      // Группы, чьи строки сменились; прочие — прежние объекты с прежними агрегатами.
      touched: string[]
    }[] = [
      // Строка переезжает из группы g3 в g5.
      { step: setScore('r10', 5), touched: ['grp:g3', 'grp:g5'] },
      {
        step: d =>
          d.map(item => (item.id === 'r11' ? { ...item, name: 'x' } : item)),
        touched: ['grp:g4'],
      },
      // Новая группа появляется последней.
      {
        step: d => [...d, { id: 'x1', name: 'x1', score: 40 }],
        touched: ['grp:g40'],
      },
      // Группа g6 уходит целиком; строки после первой удалённой сдвинуты — все группы новые.
      { step: d => d.filter(item => item.score !== 6), touched: ['*'] },
    ]
    for (const [name, plugins, read] of [
      [
        'группировка',
        () => [rowGroupingModel({ initialGrouping: ['grp'] })],
        'getGroupedRowModel',
      ],
      [
        'группировка, сортировка и раскрытие',
        () => [
          rowGroupingModel({ initialGrouping: ['grp'] }),
          columnSortingModel({ initialSorting: [{ id: 'score', desc: true }] }),
          rowExpanding({ initialExpanded: { 'grp:g1': true, 'grp:g3': true } }),
        ],
        'getRowModel',
      ],
    ] as const) {
      const options: HostOptions = {
        columns,
        plugins: plugins(),
        read: table => table[read](),
      }
      let data = make(2000)
      const grid = host(data, options)
      for (const [n, { step, touched }] of steps.entries()) {
        const before = groupOf(grid.table().getGroupedRowModel())
        data = step(data)
        reads = 0
        grid.set(data)
        const grouped = grid.table().getGroupedRowModel() as Model
        expect(reads, `${name}: чтения значений, шаг ${n}`).toBeLessThan(100)
        expect(rowModelChangeOf(grouped), `${name}, шаг ${n}`).toBeDefined()
        for (const [id, group] of Object.entries(groupOf(grouped))) {
          if (touched.includes('*') || touched.includes(id) || !before[id])
            continue
          expect(group, `${name}: группа ${id}, шаг ${n}`).toBe(before[id])
        }
        const full = host(data, options)
        expect(shape(grid.model()), `${name}, шаг ${n}`).toEqual(
          shape(full.model()),
        )
        expect(totals(grouped)).toEqual(
          totals(full.table().getGroupedRowModel()),
        )
      }
      expect(
        groupOf(grid.table().getGroupedRowModel())['grp:g6'],
      ).toBeUndefined()
    }
  })

  it('IU8: изменение внутри поддерева — инкремент поддерева в модели ядра и в модели раскрытия; итог совпадает с полной сборкой', () => {
    const options: HostOptions = {
      plugins: [
        rowExpanding({ initialExpanded: { r100: true, r150: true, r0: true } }),
      ],
      read: table => table.getRowModel(),
    }
    let data = make(2000, 50)
    const grid = host(data, options)
    const core = grid.table().getCoreRowModel() as Model
    const rows = grid.model().rows
    // Обход раскрытия спрашивает строку с детьми, раскрыта ли она: полная сборка — каждую.
    const asked = vi.spyOn(Object.getPrototypeOf(core.rows[0]), 'getIsExpanded')
    data = data.map(item =>
      item.id === 'r100'
        ? {
            ...item,
            kids: item.kids!.map((kid, k) =>
              k === 1 ? { ...kid, name: 'kid*' } : kid,
            ),
          }
        : item,
    )
    grid.set(data)
    expect(asked.mock.calls.length).toBeLessThan(5)
    const nextCore = grid.table().getCoreRowModel() as Model
    expect(rowModelChangeOf(nextCore)).toBeDefined()
    expect(nextCore.rowsById.r100).not.toBe(core.rowsById.r100)
    expect(nextCore.rowsById['r100.1']).not.toBe(core.rowsById['r100.1'])
    for (const id of ['r100.0', 'r100.2', 'r150', 'r150.1', 'r0.0']) {
      expect(nextCore.rowsById[id], id).toBe(core.rowsById[id])
    }
    const next = grid.model()
    // Модель раскрытия собрана из прошлой: место первого изменения — у строки r100.
    expect(firstChangeSince(next.rows, rows)).toBe(
      rows.findIndex(row => row.id === 'r100'),
    )
    expect(
      rowModelChangeOf(grid.table().getPreExpandedRowModel()),
    ).toBeDefined()
    // Участки раскрытых корней вне смены — прежние строки модели раскрытия.
    for (const id of ['r0', 'r0.0', 'r150', 'r150.2']) {
      const at = next.rows.findIndex(row => row.id === id)
      expect(next.rows[at], id).toBe(rows.find(row => row.id === id))
    }
    expect(shape(next)).toEqual(shape(fullBuild(data, options)))
    // Вставка корня перед раскрытыми: число корней другое, участки переходят.
    data = [{ id: 'x', name: 'x' }, ...data]
    asked.mockClear()
    grid.set(data)
    expect(asked.mock.calls.length).toBeLessThan(5)
    // Место первого изменения — у вставленного корня; полная сборка его не пишет.
    expect(firstChangeSince(grid.model().rows, next.rows)).toBe(0)
    expect(shape(grid.model())).toEqual(shape(fullBuild(data, options)))
  })

  it('IU9: смена data из прежней модели зовёт те же автосбросы TanStack, что полная сборка; так же в ленивой модели дерева', () => {
    const RESETS = [
      'autoResetExpanded',
      'autoResetPageIndex',
      'autoResetCellSelection',
    ]
    for (const [plugins, expected] of [
      [[cellSelectionModel()], []],
      [[cellSelectionModel(), rowExpanding()], ['autoResetExpanded']],
    ] as const) {
      const data = make(20)
      const grid = host(data, { plugins: [...plugins] })
      // Экземпляр, который видят модели строк: его ссылку несёт каждая строка.
      const table = (grid.model().rows[0] as any).table
      const spies = RESETS.filter(
        name => typeof table[name] === 'function',
      ).map(name => [name, vi.spyOn(table, name)] as const)
      // Автосброс есть у таблицы, если есть его фича; у полной сборки TanStack — те же.
      expect(spies.length).toBeGreaterThan(0)
      expect(spies.map(([name]) => name)).toEqual(
        expect.arrayContaining([...expected]),
      )
      grid.set(replaceAt(data, 5))
      expect(rowModelChangeOf(grid.model())).toBeDefined()
      for (const [name, spy] of spies) expect(spy, name).toHaveBeenCalled()
    }
  })
})
