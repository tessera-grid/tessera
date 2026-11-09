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
import { describe, expect, it } from 'vitest'

import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { rowGroupingModel } from '../plugins'

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

const build = () => {
  const all = [REACTIVITY, rowGroupingModel()]
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
  } as never) as any
}

const buildStock = () =>
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
  it('EN15: строки-группы с полями группы и агрегатами, заданными при создании, — итог как у createGroupedRowModel на одном и двух уровнях, при смене data и переезде строки между группами, кэши строк не пишутся', () => {
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
  })
})
