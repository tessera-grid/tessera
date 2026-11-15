// @vitest-environment happy-dom
/**
 * Сводка колонки — выбор функции агрегата пользователем (ADR 0230; SU1–SU4, SU6, SU10, SU13–SU14).
 * Запуск: npx vitest run --config vitest.node.config.ts columnAggregation
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveLabels } from '../core/localization/resolveLabels'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnAggregation,
  columnTotals,
  dataExport,
  type ExportRequest,
  rowGroupingModel,
  serverRowModel,
} from '../plugins'
import { columnAggregationLabels } from '../plugins/columnAggregation/labels'
import {
  canSummarize,
  functionLabel,
  functionsOf,
} from '../plugins/columnAggregation/functions'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  city: string
  amount: number
  day: Date
}

const ROWS: Item[] = [
  { id: 'a', city: 'Paris', amount: 10, day: new Date(2026, 0, 3) },
  { id: 'b', city: 'Paris', amount: 30, day: new Date(2026, 0, 1) },
  { id: 'c', city: 'Rome', amount: 20, day: new Date(2026, 0, 2) },
]

const cityColumn = { id: 'city', accessorKey: 'city', dataType: 'text' }
const dayColumn = { id: 'day', accessorKey: 'day', dataType: 'date' }
const amountColumn = (extra: Record<string, unknown> = {}) => ({
  id: 'amount',
  accessorKey: 'amount',
  dataType: 'number',
  aggregationFn: 'sum',
  ...extra,
})

let root: Root
let table: any

const Grid = ({
  columns = [cityColumn, dayColumn, amountColumn()],
  ...params
}: Record<string, unknown>) => {
  table = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: Item) => row.id,
    ...params,
  } as never)
  return null
}

const mount = (params: Record<string, unknown> = {}) =>
  act(() => root.render(<Grid {...params} />))
const total = () => table.getColumnTotal('amount')
const choose = (value: Record<string, string | null>) =>
  act(() => table.setColumnAggregations(() => value))
const groupValues = () =>
  Object.fromEntries(
    table
      .getRowModel()
      .rows.filter((row: { getIsGrouped: () => boolean }) => row.getIsGrouped())
      .map(
        (row: { groupingValue: string; getValue: (id: string) => unknown }) => [
          row.groupingValue,
          row.getValue('amount'),
        ],
      ),
  )
const column = (id: string) => table.getColumn(id)

beforeEach(() => {
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('сводка колонки (ADR 0230)', () => {
  it('SU1: срез главнее aggregationFn — имя задаёт функцию, null — итога нет, нет ключа — функция колонки; без плагина действует aggregationFn', async () => {
    await mount({ plugins: [columnTotals(), columnAggregation()] })
    expect(total()).toBe(60)
    await choose({ amount: 'mean' })
    expect(total()).toBe(20)
    await choose({ amount: 'max' })
    expect(total()).toBe(30)
    await choose({ amount: null })
    expect(total()).toBeUndefined()
    await choose({})
    expect(total()).toBe(60)

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    await mount({ plugins: [columnTotals()] })
    expect(total()).toBe(60)
    expect(table.setColumnAggregations).toBeUndefined()
  })

  it('SU2: выбранная функция задаёт и итог, и значения строк-групп; с группировкой без строки итогов — тоже; смена выбора пересчитывает группы', async () => {
    await mount({
      plugins: [
        columnTotals(),
        rowGroupingModel({ initialGrouping: ['city'] }),
        columnAggregation(),
      ],
    })
    expect(groupValues()).toEqual({ Paris: 40, Rome: 20 })
    await choose({ amount: 'max' })
    expect(groupValues()).toEqual({ Paris: 30, Rome: 20 })
    expect(total()).toBe(30)
    await choose({ amount: null })
    expect(groupValues()).toEqual({ Paris: undefined, Rome: undefined })

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    await mount({
      plugins: [
        rowGroupingModel({ initialGrouping: ['city'] }),
        columnAggregation({ initialColumnAggregations: { amount: 'count' } }),
      ],
    })
    expect(groupValues()).toEqual({ Paris: 2, Rome: 1 })
    await choose({ amount: 'mean' })
    expect(groupValues()).toEqual({ Paris: 20, Rome: 20 })
  })

  it('SU3: список — поле колонки, иначе поле типа в реестре dataTypes, иначе встроенный по базовому типу; функция по умолчанию входит всегда', async () => {
    await mount({
      columns: [
        cityColumn,
        dayColumn,
        amountColumn(),
        { id: 'code', accessorKey: 'id', dataType: 'numberString' },
        amountColumn({ id: 'own', aggregationFns: ['min', 'max'] }),
        { id: 'score', accessorKey: 'amount', dataType: 'score' },
      ],
      dataTypes: {
        score: { extends: 'number', aggregationFns: ['mean'] },
      },
      plugins: [columnTotals(), columnAggregation()],
    })
    expect(functionsOf(table, column('amount'))).toEqual([
      'sum',
      'mean',
      'median',
      'min',
      'max',
      'count',
    ])
    expect(functionsOf(table, column('day'))).toEqual(['min', 'max', 'count'])
    expect(functionsOf(table, column('city'))).toEqual(['count', 'uniqueCount'])
    expect(functionsOf(table, column('code'))).toEqual(['count', 'uniqueCount'])
    // Своё поле колонки главнее типа; функция по умолчанию — первой.
    expect(functionsOf(table, column('own'))).toEqual(['sum', 'min', 'max'])
    expect(functionsOf(table, column('score'))).toEqual(['mean'])
    await choose({ city: 'uniqueCount' })
    expect(table.getColumnTotal('city')).toBe(2)
  })

  it('SU4: своя функция с подписью входит в список колонок своих типов и там, где её назвали, считает итог и значения групп', async () => {
    const functions = {
      range: {
        label: 'Spread',
        dataTypes: ['number'] as const,
        aggregate: ({
          rows,
          columnId,
        }: {
          rows: readonly { getValue: (id: string) => unknown }[]
          columnId: string
        }) => {
          const values = rows.map(row => row.getValue(columnId) as number)
          return Math.max(...values) - Math.min(...values)
        },
      },
    }
    await mount({
      plugins: [
        columnTotals(),
        rowGroupingModel({ initialGrouping: ['city'] }),
        columnAggregation({ functions }),
      ],
    })
    expect(functionsOf(table, column('amount'))).toContain('range')
    expect(functionsOf(table, column('city'))).not.toContain('range')
    expect(functionLabel(table, 'range', resolveLabels(undefined, 'en'))).toBe(
      'Spread',
    )
    await choose({ amount: 'range' })
    expect(total()).toBe(20)
    expect(groupValues()).toEqual({ Paris: 20, Rome: 0 })
  })

  it('SU6: пункта нет без строки итогов и группировки, у колонки, которую запретил canSummarizeColumn, и у колонки без функций', async () => {
    await mount({ plugins: [columnAggregation()] })
    expect(canSummarize(table, column('amount'))).toBe(false)

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    await mount({
      plugins: [rowGroupingModel(), columnAggregation()],
    })
    expect(canSummarize(table, column('amount'))).toBe(false)
    await act(() => table.setGrouping(['city']))
    expect(canSummarize(table, column('amount'))).toBe(true)

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    await mount({
      columns: [
        cityColumn,
        amountColumn(),
        amountColumn({
          id: 'none',
          aggregationFns: [],
          aggregationFn: undefined,
        }),
      ],
      plugins: [
        columnTotals(),
        columnAggregation({
          canSummarizeColumn: (target: { id: string }) => target.id !== 'city',
        }),
      ],
    })
    expect(canSummarize(table, column('amount'))).toBe(true)
    expect(canSummarize(table, column('city'))).toBe(false)
    expect(canSummarize(table, column('none'))).toBe(false)
  })

  it('SU10: initialColumnAggregations задаёт выбор при открытии, колбэк получает новый срез, setColumnAggregations меняет выбор из кода', async () => {
    const changes: unknown[] = []
    await mount({
      plugins: [
        columnTotals(),
        columnAggregation({
          initialColumnAggregations: { amount: 'min' },
          onColumnAggregationsChange: next => void changes.push(next),
        }),
      ],
    })
    expect(total()).toBe(10)
    await choose({ amount: 'max' })
    expect(total()).toBe(30)
    expect(changes).toEqual([{ amount: 'max' }])
  })

  it('SU13: запрос серверной выгрузки несёт выбранную функцию в aggregations, своя функция — своим именем, «Без сводки» — без колонки', async () => {
    const exports: ExportRequest[] = []
    const getRows = () => Promise.resolve({ rows: ROWS, rowCount: 3 })
    await mount({
      data: [],
      dataMode: { export: 'server' },
      plugins: [
        serverRowModel({ getRows } as never),
        columnTotals(),
        dataExport({ onExport: request => void exports.push(request) }),
        columnAggregation({
          functions: {
            spread: { label: 'Spread', aggregate: () => 0 },
          },
        }),
      ],
    })
    await act(() => table.exportData({ rows: 'all' }))
    expect(exports[0]!.query!.aggregations).toEqual({ amount: 'sum' })
    await choose({ amount: 'mean' })
    await act(() => table.exportData({ rows: 'all' }))
    expect(exports[1]!.query!.aggregations).toEqual({ amount: 'mean' })
    await choose({ amount: 'spread' })
    await act(() => table.exportData({ rows: 'all' }))
    expect(exports[2]!.query!.aggregations).toEqual({ amount: 'spread' })
    await choose({ amount: null })
    await act(() => table.exportData({ rows: 'all' }))
    expect(exports[3]!.query!.aggregations).toEqual({})
  })

  it('SU14: подписи функций и «Без сводки» — из словаря localization по ключам columnAggregation.*', async () => {
    await mount({ plugins: [columnTotals(), columnAggregation()] })
    const ru = resolveLabels(
      {
        'columnAggregation.mean': 'Среднее',
        'columnAggregation.uniqueCount': 'Число разных',
        'columnAggregation.noSummary': 'Без сводки',
      },
      'ru',
    )
    expect(columnAggregationLabels(ru).noSummary).toBe('Без сводки')
    expect(functionLabel(table, 'mean', ru)).toBe('Среднее')
    expect(functionLabel(table, 'uniqueCount', ru)).toBe('Число разных')
    expect(functionLabel(table, 'sum', resolveLabels(undefined, 'en'))).toBe(
      'Sum',
    )
  })
})
