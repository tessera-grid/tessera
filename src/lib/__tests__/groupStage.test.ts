/**
 * Стадия группировки движка (ADR 0200, этап 2; EN15): итог как у стоковой
 * `createGroupedRowModel`, значения строк-групп заданы при создании, кэши строк стадия не пишет.
 * Запуск: npx vitest run --config vitest.node.config.ts groupStage
 */
import {
  aggregationFn_count,
  aggregationFn_mean,
  aggregationFn_sum,
  columnGroupingFeature,
  constructTable,
  createGroupedRowModel,
  rowAggregationFeature,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import { resolveHooks } from '../core/createHooks'
import {
  buildTesseraFeatures,
  foldEntries,
  foldHooks,
  type TesseraFeatureEntry,
} from '../core/features'
import { columnAggregation, rowDragging, rowGroupingModel } from '../plugins'

interface Item {
  id: string
  city: string
  team: string
  age: number
}

const DATA: Item[] = Array.from({ length: 24 }, (_, i) => ({
  id: `r${i}`,
  city: ['Paris', 'Rome', 'Oslo'][(i * 7) % 3]!,
  team: ['red', 'blue'][(i * 5) % 2]!,
  age: 20 + ((i * 13) % 17),
}))

const COLUMNS = [
  { id: 'id', accessorKey: 'id' },
  {
    id: 'city',
    accessorKey: 'city',
    getGroupingValue: (row: Item) => row.city.toUpperCase(),
  },
  { id: 'team', accessorKey: 'team', aggregationFn: 'count' },
  { id: 'age', accessorKey: 'age', aggregationFn: 'sum' },
  { id: 'mean', accessorFn: (row: Item) => row.age, aggregationFn: 'mean' },
]

const REACTIVITY = {
  id: 'reactivity',
  features: { coreReactivityFeature: storeReactivityBindings() },
}

const build = (extra: object = {}, plugins: TesseraFeatureEntry[] = []) => {
  const all = [REACTIVITY, rowGroupingModel(), ...plugins]
  const folded = foldEntries(all as never)
  return constructTable({
    features: buildTesseraFeatures(all as never),
    data: DATA,
    columns: COLUMNS,
    getRowId: (row: Item) => row.id,
    ...folded.options,
    hooks: resolveHooks(foldHooks(all as never)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
    ...extra,
  } as never) as any
}

const buildStock = (extra: object = {}) =>
  constructTable({
    features: {
      coreReactivityFeature: storeReactivityBindings(),
      columnGroupingFeature,
      rowAggregationFeature,
      groupedRowModel: createGroupedRowModel(),
      aggregationFns: {
        sum: aggregationFn_sum,
        count: aggregationFn_count,
        mean: aggregationFn_mean,
      },
    },
    data: DATA,
    columns: COLUMNS,
    getRowId: (row: Item) => row.id,
    logLevel: 'error',
    ...extra,
  } as never) as any

/** Строки модели группировки: место, связи, поля группы, значения и агрегаты. */
const shape = (table: any) =>
  table.getGroupedRowModel().flatRows.map((row: any) => ({
    id: row.id,
    depth: row.depth,
    parentId: row.parentId,
    index: row.index,
    groupingColumnId: row.groupingColumnId,
    groupingValue: row.groupingValue,
    subRows: row.subRows.map((child: any) => child.id),
    leafRows: row.leafRows?.map((leaf: any) => leaf.id),
    values: COLUMNS.map(column => row.getValue(column.id)),
  }))

describe('Стадия группировки движка (ADR 0200)', () => {
  it('переносит строку между группами в ожидании ответа, сохраняя остальные группы', () => {
    const table = build({}, [rowDragging()])
    table.setGrouping(['city'])
    const initial = table.getGroupedRowModel()
    const paris = initial.rowsById['city:PARIS']

    table.setRowMoves({
      r4: { attempt: 1, pending: true, group: { city: 'OSLO' } },
    })
    const first = table.getGroupedRowModel()
    expect(first.rowsById.r4.parentId).toBe('city:OSLO')
    expect(first.rowsById['city:PARIS']).toBe(paris)

    table.setRowMoves({
      r4: { attempt: 2, pending: true, group: { city: 'PARIS' } },
    })
    const second = table.getGroupedRowModel()
    expect(second.rowsById.r4.parentId).toBe('city:PARIS')
    expect(second.rowsById['city:ROME']).toBe(first.rowsById['city:ROME'])

    table.setRowMoves({})
    expect(table.getGroupedRowModel().rowsById.r4.parentId).toBe('city:ROME')
  })

  it('меняет агрегаты на двух уровнях, сохраняя состав и порядок листьев', () => {
    const table = build({}, [columnAggregation()])
    table.setGrouping(['city', 'team'])
    const first = table.getGroupedRowModel()
    const city = first.rows[0]
    const team = city.subRows[0]
    const sum = city.getValue('age')
    const teamSum = team.getValue('age')
    const mean = city.getValue('mean')
    const readLeaf = vi.spyOn(team.leafRows[0], 'getValue')

    table.setColumnAggregations({ age: 'count' })
    const next = table.getGroupedRowModel()
    const newCity = next.rowsById[city.id]
    const newTeam = next.rowsById[team.id]
    expect(newCity.getValue('age')).toBe(city.leafRows.length)
    expect(newTeam.getValue('age')).toBe(team.leafRows.length)
    expect(newCity.subRows[0]).toBe(newTeam)
    expect(newTeam.subRows).toBe(team.subRows)
    expect(newTeam.leafRows).toBe(team.leafRows)
    expect(newCity.getValue('mean')).toBe(mean)
    expect(readLeaf).not.toHaveBeenCalledWith('mean')
    expect(next.flatRows.map((row: { id: string }) => row.id)).toEqual(
      first.flatRows.map((row: { id: string }) => row.id),
    )
    expect(first.rowsById[city.id]).toBe(city)
    expect(city.getValue('age')).toBe(sum)
    expect(team.getValue('age')).toBe(teamSum)
  })

  it('EN15: строки-группы с полями группы и агрегатами, заданными при создании, — итог как у createGroupedRowModel на одном и двух уровнях, при смене data и переезде строки между группами, на дереве с глубиной агрегации; кэши строк не пишутся', () => {
    const ours = build()
    const stock = buildStock()
    const writes: string[] = []
    for (const row of ours.getCoreRowModel().flatRows) {
      for (const key of ['_valuesCache', '_groupingValuesCache']) {
        const cache = row[key] as Record<string, unknown>
        row[key] = new Proxy(cache, {
          set: (target, column, value) => {
            writes.push(`${row.id}.${key}.${String(column)}`)
            return Reflect.set(target, column, value)
          },
        })
      }
    }
    // Значения строк данных читает и стоковая проверка: кэш значений заполняют сами строки.
    const dataWrites = () =>
      writes.filter(write => write.includes('_groupingValuesCache'))

    for (const [step, apply] of [
      ['один уровень', (t: any) => t.setGrouping(['city'])],
      ['два уровня', (t: any) => t.setGrouping(['city', 'team'])],
      [
        'строка переезжает между группами',
        (t: any) =>
          t.setOptions((o: any) => ({
            ...o,
            data: o.data.map((row: Item, i: number) =>
              i === 4 ? { ...row, city: 'Lima', age: 99 } : row,
            ),
          })),
      ],
      [
        'дописывание в data',
        (t: any) =>
          t.setOptions((o: any) => ({
            ...o,
            data: [...o.data, { id: 'x', city: 'Rome', team: 'red', age: 41 }],
          })),
      ],
      ['одна колонка снова', (t: any) => t.setGrouping(['team'])],
    ] as const) {
      apply(ours)
      apply(stock)
      expect(shape(ours), step).toEqual(shape(stock))
    }
    expect(dataWrites()).toEqual([])
    // Значения строки-группы — свои, заданные при создании.
    const group = ours.getGroupedRowModel().rows[0]
    expect(Object.hasOwn(group, 'getValue')).toBe(true)
    expect(group._valuesCache).toEqual({})

    ours.setGrouping([])
    stock.setGrouping([])
    expect(shape(ours)).toEqual(shape(stock))

    // Дерево на входе: по группам — корни, ветки идут за ними; агрегат — с глубиной.
    const tree = {
      data: DATA.slice(0, 8).map((row, i) => ({
        ...row,
        subRows: [
          { id: `${row.id}.a`, city: 'Lima', team: 'red', age: 10 + i },
          { id: `${row.id}.b`, city: 'Oslo', team: 'blue', age: 20 + i },
        ],
      })),
      getSubRows: (row: Item & { subRows?: Item[] }) => row.subRows,
      columns: COLUMNS.map(column =>
        column.id === 'age' ? { ...column, maxAggregationDepth: 1 } : column,
      ),
    }
    const ourTree = build(tree)
    const stockTree = buildStock(tree)
    for (const grouping of [['city'], ['city', 'team'], []]) {
      ourTree.setGrouping(grouping)
      stockTree.setGrouping(grouping)
      expect(shape(ourTree), `дерево: ${grouping.join()}`).toEqual(
        shape(stockTree),
      )
    }
  })
})
