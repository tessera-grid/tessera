/**
 * Тип данных колонки (ADR 0172, §1–§3): встроенные типы, реестр `dataTypes`, разрешение типа
 * через `column.getDataType()` и формат `Intl`.
 * Запуск: npx vitest run --config vitest.node.config.ts dataTypes
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatDataTypeValue } from '../core/dataTypeFormat'
import { BUILT_IN_DATA_TYPES } from '../core/dataTypes'
import { __resetLogger } from '../util/logger'
import { modules, sourceOf } from './importGraph'
import { hostTable } from './tableHost'

afterEach(() => {
  __resetLogger()
  vi.restoreAllMocks()
})

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

const tableWith = (
  columns: Record<string, unknown>[],
  options: Record<string, unknown> = {},
) => hostTable({ columns, timeZone: 'UTC', ...options }) as any

const textOf = (table: any, columnId: string, value: unknown) =>
  formatDataTypeValue(table, table.getColumn(columnId), value, {})

describe('тип данных колонки (ADR 0172)', () => {
  it('DT1: встроенные типы и вид значения в данных: text — строка, number — число, boolean — булево, date и dateTime — Date, dateString — YYYY-MM-DD, dateTimeString — ISO со временем, select — значение варианта, multiSelect — массив значений', () => {
    expect([...BUILT_IN_DATA_TYPES]).toEqual([
      'text',
      'number',
      'boolean',
      'date',
      'dateTime',
      'dateString',
      'dateTimeString',
      'select',
      'multiSelect',
    ])
    const table = tableWith(
      BUILT_IN_DATA_TYPES.map(type => ({
        id: type,
        accessorKey: type,
        dataType: type,
        ...(type.endsWith('elect') && { options: OPTIONS }),
      })),
    )
    for (const type of BUILT_IN_DATA_TYPES) {
      expect(table.getColumn(type).getDataType().base).toBe(type)
    }
    const moment = new Date('2026-10-31T14:05:00Z')
    expect(textOf(table, 'text', 'Desk')).toBe('Desk')
    expect(textOf(table, 'number', 1234.5)).toBe('1234.5')
    expect(textOf(table, 'boolean', true)).toBe('true')
    expect(textOf(table, 'date', moment)).toBe('2026-10-31')
    expect(textOf(table, 'dateTime', moment)).toBe('2026-10-31 14:05')
    expect(textOf(table, 'dateString', '2026-10-31')).toBe('2026-10-31')
    expect(textOf(table, 'dateTimeString', '2026-10-31T14:05:00Z')).toBe(
      '2026-10-31 14:05',
    )
    expect(textOf(table, 'select', 'b')).toBe('Beta')
    expect(textOf(table, 'multiSelect', ['a', 'b'])).toBe('Alpha, Beta')
  })

  it('DT2: реестр dataTypes — свой тип с extends наследует непереопределённые поля по цепочке, запись с именем встроенного типа меняет все его колонки, поле колонки главнее поля типа; неизвестное имя или цикл extends — предупреждение в dev, колонка ведёт себя как без типа', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const table = tableWith(
      [
        { id: 'price', accessorKey: 'price', dataType: 'money' },
        { id: 'cost', accessorKey: 'cost', dataType: 'cents' },
        { id: 'own', accessorKey: 'own', dataType: 'money', align: 'start' },
        { id: 'qty', accessorKey: 'qty', dataType: 'number' },
        { id: 'count', accessorKey: 'count', dataType: 'number' },
        { id: 'lost', accessorKey: 'lost', dataType: 'nope' },
        { id: 'loop', accessorKey: 'loop', dataType: 'ping' },
      ],
      {
        dataTypes: {
          money: {
            extends: 'number',
            format: { style: 'currency', currency: 'USD' },
            align: 'end',
          },
          // Цепочка: формат и выравнивание — от «денег», свой разбор.
          cents: { extends: 'money', parseValue: (text: string) => text },
          number: { format: { maximumFractionDigits: 0 } },
          ping: { extends: 'pong' },
          pong: { extends: 'ping' },
        },
      },
    )
    const cost = table.getColumn('cost').getDataType()
    expect(cost.base).toBe('number')
    expect(cost.definition.align).toBe('end')
    expect(cost.definition.format).toEqual({
      style: 'currency',
      currency: 'USD',
    })
    expect(typeof cost.definition.parseValue).toBe('function')
    // Замена встроенного типа — во всех его колонках.
    expect(textOf(table, 'qty', 2.6)).toBe('3')
    expect(textOf(table, 'count', 7.4)).toBe('7')
    // Поле колонки главнее поля типа.
    expect(table.getColumn('own').getDataType().definition.align).toBe('start')
    // Неизвестное имя и цикл — предупреждение и колонка без типа.
    expect(table.getColumn('lost').getDataType()).toBeUndefined()
    expect(table.getColumn('loop').getDataType()).toBeUndefined()
    expect(textOf(table, 'lost', 2.6)).toBe('2.6')
    const warnings = warn.mock.calls.map(call => String(call[0]))
    expect(warnings.some(text => text.includes('"nope"'))).toBe(true)
    expect(warnings.some(text => text.includes('cycle'))).toBe(true)
  })

  it('DT3: тип разрешается один раз на описание колонки и реестр, не на ячейку; column.getDataType() отдаёт имя, базовый тип и итоговое определение, ячейка и плагины узнают тип только так; страж — никто не читает columnDef.dataType в обход', () => {
    const registry = { money: { extends: 'number', align: 'end' as const } }
    const columns = [{ id: 'price', accessorKey: 'price', dataType: 'money' }]
    const table = tableWith(columns, { dataTypes: registry })
    const resolved = table.getColumn('price').getDataType()
    expect(resolved).toEqual({
      name: 'money',
      base: 'number',
      definition: { align: 'end' },
    })
    // Повторный вопрос — прежний итог; новый реестр той же таблицы — новый.
    expect(table.getColumn('price').getDataType()).toBe(resolved)
    table.setOptions((old: object) => ({ ...old, dataTypes: { ...registry } }))
    const next = table.getColumn('price').getDataType()
    expect(next).not.toBe(resolved)
    expect(next).toEqual(resolved)

    const readers = modules()
      .map(module => module.path)
      .filter(path => !/\/(__tests__|stories)\//.test(path))
      .filter(path => /\.dataType\b/.test(sourceOf(path)))
    expect(readers).toEqual(['lib/core/dataTypes.ts'])
  })

  it('DT7: format — опции Intl.NumberFormat и Intl.DateTimeFormat на языке таблицы; formatValue(value, row) главнее format; оба задаются у колонки или у типа', () => {
    const money = { style: 'currency', currency: 'EUR' } as const
    const columns = [
      { id: 'price', accessorKey: 'price', dataType: 'number', format: money },
      { id: 'cost', accessorKey: 'cost', dataType: 'money' },
      {
        id: 'day',
        accessorKey: 'day',
        dataType: 'dateString',
        format: { dateStyle: 'long' },
      },
      {
        id: 'label',
        accessorKey: 'label',
        dataType: 'number',
        format: money,
        formatValue: (value: unknown, row: { unit: string }) =>
          `${String(value)} ${row.unit}`,
      },
      { id: 'tagged', accessorKey: 'tagged', dataType: 'tagged' },
    ]
    const dataTypes = {
      money: { extends: 'number', format: money },
      tagged: {
        extends: 'number',
        format: money,
        formatValue: (value: unknown) => `#${String(value)}`,
      },
    }
    for (const locale of ['en-US', 'de-DE']) {
      const table = tableWith(columns, { locale, dataTypes })
      const euro = new Intl.NumberFormat(locale, money).format(1234.5)
      expect(textOf(table, 'price', 1234.5)).toBe(euro)
      expect(textOf(table, 'cost', 1234.5)).toBe(euro)
      expect(textOf(table, 'day', '2026-10-31')).toBe(
        new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeZone: 'UTC',
        }).format(new Date('2026-10-31T00:00:00Z')),
      )
      expect(
        formatDataTypeValue(table, table.getColumn('label'), 5, { unit: 'kg' }),
      ).toBe('5 kg')
      expect(textOf(table, 'tagged', 5)).toBe('#5')
    }
  })
})
