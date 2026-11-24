/**
 * Тип данных колонки (ADR 0172, §1–§3): встроенные типы, реестр `dataTypes`, разрешение типа
 * через `column.getDataType()` и формат `Intl`.
 * Запуск: npx vitest run --config vitest.node.config.ts dataTypes
 */
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatDataTypeValue, objectKeyOf } from '../core/dataTypeFormat'
import { BUILT_IN_DATA_TYPES } from '../core/dataTypes'
import {
  columnFiltering,
  columnSorting,
  quickSearch,
  rowGrouping,
} from '../plugins'
import { columnFilterDefOf } from '../plugins/columnFilteringModel/conditions'
import {
  filterOptionLabelOf,
  filterOptionsOf,
  optionCountsOf,
} from '../plugins/columnFilteringModel/options'
import { csvFormat } from '../plugins/dataExportModel/csv'
import { collectExportData } from '../plugins/dataExportModel/exportData'
import { buildXlsx } from '../plugins/dataExportModel/xlsxBuild'
import { __resetLogger } from '../util/logger'
import { parseLocaleDecimal } from '../util/parseNumber'
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
  it('DT1: встроенные типы и вид значения в данных: text — строка, number — число, boolean — булево, date и dateTime — Date, dateString — YYYY-MM-DD, dateTimeString — ISO со временем, select — значение варианта, multiSelect — массив значений, object — запись, numberString — десятичная строка (ADR 0174)', () => {
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
      'object',
      'numberString',
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
      .filter(path => /columnDef\??\.dataType\b/.test(sourceOf(path)))
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

describe('фичи по типу данных колонки (ADR 0172, этап 2)', () => {
  const dotted = (value: unknown) => {
    const [day, month, year] = String(value).split('.')
    return `${year}-${month}-${day}`
  }

  const sortedIds = (table: any, id: string, desc = false) => {
    table.setSorting([{ id, desc }])
    return table.getSortedRowModel().rows.map((row: { id: string }) => row.id)
  }

  it('DT10: сортировка по базовому типу — текст Intl.Collator языка с числами по значению без учёта регистра; числа; сначала false, потом true; даты по времени; даты-строки разбором, свой формат правилом типа; варианты по подписи; пустые в конце при обоих направлениях; sortFn и sortUndefined колонки главнее', () => {
    const rows = [
      {
        id: 'a',
        text: 'item 10',
        num: 10,
        flag: true,
        day: '2026-03-01',
        when: new Date('2026-03-01T10:00:00Z'),
        own: '01.03.2026',
        pick: 'b',
        mine: 3,
      },
      {
        id: 'b',
        text: 'Item 2',
        num: 2,
        flag: false,
        day: '2026-01-15',
        when: new Date('2026-01-15T10:00:00Z'),
        own: '15.01.2026',
        pick: 'a',
        mine: 1,
      },
      {
        id: 'c',
        text: null,
        num: null,
        flag: null,
        day: null,
        when: null,
        own: null,
        pick: null,
        mine: 2,
      },
      {
        id: 'd',
        text: 'item 1',
        num: 1,
        flag: true,
        day: '2026-02-10',
        when: new Date('2026-02-10T10:00:00Z'),
        own: '10.02.2026',
        pick: 'c',
        mine: 4,
      },
    ]
    const table = hostTable({
      data: rows,
      getRowId: (row: { id: string }) => row.id,
      columns: [
        { id: 'text', accessorKey: 'text', dataType: 'text' },
        { id: 'num', accessorKey: 'num', dataType: 'number' },
        { id: 'flag', accessorKey: 'flag', dataType: 'boolean' },
        { id: 'day', accessorKey: 'day', dataType: 'dateString' },
        { id: 'when', accessorKey: 'when', dataType: 'dateTime' },
        { id: 'own', accessorKey: 'own', dataType: 'dotted' },
        {
          id: 'pick',
          accessorKey: 'pick',
          dataType: 'select',
          options: [
            { value: 'c', label: 'Alpha' },
            { value: 'a', label: 'Beta' },
            { value: 'b', label: 'Gamma' },
          ],
        },
        {
          id: 'mine',
          accessorKey: 'mine',
          dataType: 'number',
          sortFn: (rowA: any, rowB: any) =>
            rowB.original.mine - rowA.original.mine,
        },
        {
          id: 'undef',
          accessorFn: (row: { num: number | null }) => row.num ?? undefined,
          dataType: 'number',
          sortUndefined: 'first',
        },
      ],
      dataTypes: { dotted: { extends: 'dateString', parseDate: dotted } },
      plugins: [columnSorting()],
    }) as any
    expect(sortedIds(table, 'text')).toEqual(['d', 'b', 'a', 'c'])
    expect(sortedIds(table, 'text', true)).toEqual(['a', 'b', 'd', 'c'])
    expect(sortedIds(table, 'num')).toEqual(['d', 'b', 'a', 'c'])
    expect(sortedIds(table, 'num', true)).toEqual(['a', 'b', 'd', 'c'])
    expect(sortedIds(table, 'flag')).toEqual(['b', 'a', 'd', 'c'])
    expect(sortedIds(table, 'day')).toEqual(['b', 'd', 'a', 'c'])
    expect(sortedIds(table, 'when', true)).toEqual(['a', 'd', 'b', 'c'])
    expect(sortedIds(table, 'own')).toEqual(['b', 'd', 'a', 'c'])
    expect(sortedIds(table, 'pick')).toEqual(['d', 'b', 'a', 'c'])
    // Своя функция колонки главнее сортировки по типу.
    expect(sortedIds(table, 'mine')).toEqual(['d', 'a', 'c', 'b'])
    // sortUndefined колонки: undefined первым, а не в конце, как пустые по типу.
    expect(sortedIds(table, 'undef')).toEqual(['c', 'd', 'b', 'a'])
  })

  it('DT13: условия фильтра сравнивают по типу — даты-строки и свои форматы дат разбором типа в поясе таблицы; лукап — loadOptions колонки или типа', () => {
    const load = async () => []
    const table = hostTable({
      data: [
        { id: 'a', day: '2026-03-01', own: '01.03.2026' },
        { id: 'b', day: '2026-01-15', own: '15.01.2026' },
        { id: 'c', day: '2026-03-02', own: '02.03.2026' },
      ],
      getRowId: (row: { id: string }) => row.id,
      columns: [
        { id: 'day', accessorKey: 'day', dataType: 'dateString' },
        { id: 'own', accessorKey: 'own', dataType: 'dotted' },
        {
          id: 'managerOwn',
          accessorKey: 'm',
          dataType: 'select',
          loadOptions: load,
        },
        { id: 'managerType', accessorKey: 'm', dataType: 'manager' },
      ],
      dataTypes: {
        dotted: { extends: 'dateString', parseDate: dotted },
        manager: { extends: 'select', loadOptions: load },
      },
      plugins: [columnFiltering()],
    }) as any
    const filtered = (id: string, value: unknown) => {
      table.setColumnFilters([{ id, value }])
      return table
        .getFilteredRowModel()
        .rows.map((row: { id: string }) => row.id)
    }
    expect(filtered('day', { operator: 'on', value: '2026-03-01' })).toEqual([
      'a',
    ])
    expect(filtered('day', { operator: 'after', value: '2026-02-01' })).toEqual(
      ['a', 'c'],
    )
    expect(filtered('own', { operator: 'on', value: '2026-03-02' })).toEqual([
      'c',
    ])
    expect(
      filtered('own', { operator: 'before', value: '2026-02-01' }),
    ).toEqual(['b'])
    for (const id of ['managerOwn', 'managerType']) {
      expect(columnFilterDefOf(table.getColumn(id))).toMatchObject({
        type: 'lookup',
        loadOptions: load,
      })
    }
  })

  it('DT17: CSV — значения, как сейчас; xlsx — тип ячейки по базовому типу; ExportColumn несёт имя и базовый тип вместо filter', async () => {
    const table = hostTable({
      data: [
        {
          id: 'a',
          price: 12.5,
          day: '2026-03-01',
          at: '2026-03-01T10:30:00Z',
          flag: true,
        },
      ],
      getRowId: (row: { id: string }) => row.id,
      columns: [
        {
          id: 'price',
          accessorKey: 'price',
          header: 'Price',
          dataType: 'money',
        },
        {
          id: 'day',
          accessorKey: 'day',
          header: 'Day',
          dataType: 'dateString',
        },
        {
          id: 'at',
          accessorKey: 'at',
          header: 'At',
          dataType: 'dateTimeString',
        },
        {
          id: 'flag',
          accessorKey: 'flag',
          header: 'Flag',
          dataType: 'boolean',
        },
      ],
      dataTypes: {
        money: {
          extends: 'number',
          format: { style: 'currency', currency: 'USD' },
        },
      },
    }) as any
    const data = collectExportData(table)
    expect(data.columns.map(column => column.dataType)).toEqual([
      { name: 'money', base: 'number' },
      { name: 'dateString', base: 'dateString' },
      { name: 'dateTimeString', base: 'dateTimeString' },
      { name: 'boolean', base: 'boolean' },
    ])
    expect(data.columns.some(column => 'filter' in column)).toBe(false)
    // CSV — значения как есть, без формата типа.
    expect(csvFormat().serialize(data).split(/\r?\n/)[1]).toBe(
      '12.5,2026-03-01,2026-03-01T10:30:00Z,true',
    )
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(
      (await (await buildXlsx(data)).arrayBuffer()) as never,
    )
    const cells = [1, 2, 3, 4].map(index =>
      workbook.worksheets[0]!.getRow(2).getCell(index),
    )
    expect(cells.map(cell => cell.type)).toEqual([
      ExcelJS.ValueType.Number,
      ExcelJS.ValueType.Date,
      ExcelJS.ValueType.Date,
      ExcelJS.ValueType.Boolean,
    ])
  })
})

describe('поиск по типу данных колонки (ADR 0172, этап 3)', () => {
  it('DT15: быстрый поиск ищет по показанному тексту: формат, подписи вариантов, даты в виде 2026-10-31; булево — вне поиска; текст кешируется на строку', () => {
    const shown = vi.fn((value: unknown) => `#${value}`)
    const table = hostTable({
      data: [
        {
          id: 'a',
          price: 1234.5,
          day: '2026-10-31',
          at: '2026-10-31T14:05:00Z',
          status: 'z',
          flag: true,
          code: 7,
        },
        {
          id: 'b',
          price: 18.9,
          day: '2026-01-02',
          at: '2026-01-02T09:00:00Z',
          status: 'a',
          flag: false,
          code: 8,
        },
      ],
      getRowId: (row: { id: string }) => row.id,
      columns: [
        { id: 'price', accessorKey: 'price', dataType: 'money' },
        { id: 'day', accessorKey: 'day', dataType: 'dateString' },
        { id: 'at', accessorKey: 'at', dataType: 'dateTimeString' },
        {
          id: 'status',
          accessorKey: 'status',
          dataType: 'select',
          options: [
            { value: 'a', label: 'Active' },
            { value: 'z', label: 'Archived' },
          ],
        },
        { id: 'flag', accessorKey: 'flag', dataType: 'boolean' },
        { id: 'code', accessorKey: 'code', dataType: 'tag' },
      ],
      dataTypes: {
        money: {
          extends: 'number',
          format: { style: 'currency', currency: 'USD' },
        },
        tag: { extends: 'text', formatValue: shown },
      },
      timeZone: 'UTC',
      plugins: [quickSearch()],
    }) as any
    const found = (query: string) => {
      table.setGlobalFilter(query)
      return table
        .getFilteredRowModel()
        .rows.map((row: { id: string }) => row.id)
    }
    // Формат типа, а не сырое число.
    expect(found('$1,234.50')).toEqual(['a'])
    expect(found('1234.5')).toEqual([])
    // Подпись варианта, а не его значение; сырое «Z» даты со временем не показано.
    expect(found('archived')).toEqual(['a'])
    expect(found('z')).toEqual([])
    // Даты — в нейтральном виде, дата со временем — в поясе таблицы.
    expect(found('2026-10-31 14:05')).toEqual(['a'])
    expect(found('2026-01-02')).toEqual(['b'])
    // Булево показано значком — поиск его обходит.
    expect(table.getColumn('flag').getCanGlobalFilter()).toBe(false)
    expect(found('true')).toEqual([])
    expect(found('#8')).toEqual(['b'])
    // Кеш: текст строки посчитан один раз за все поиски (ADR 0201).
    expect(shown).toHaveBeenCalledTimes(2)

    // Смена языка — новый показанный текст.
    table.setOptions((prev: object) => ({ ...prev, locale: 'ru-RU' }))
    const ru = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
    }).format(1234.5)
    expect(found(ru)).toEqual(['a'])
    expect(found('$1,234.50')).toEqual([])
  })
})

describe('тип object (ADR 0174, этап 1)', () => {
  const ANN = { id: 1, name: 'Ann' }
  /** Тот же менеджер другим объектом: равенство — по ключу. */
  const ANN_AGAIN = { id: 1, name: 'Ann' }
  const BOB = { id: 2, name: 'Bob' }
  const managers = (plugins: unknown[], extra: Record<string, unknown> = {}) =>
    hostTable({
      data: [
        { id: 'a', m: ANN },
        { id: 'b', m: ANN_AGAIN },
        { id: 'c', m: BOB },
        { id: 'd', m: null },
      ],
      getRowId: (row: { id: string }) => row.id,
      columns: [
        { id: 'm', accessorKey: 'm', header: 'Manager', dataType: 'object' },
      ],
      timeZone: 'UTC',
      plugins,
      ...extra,
    }) as any
  const rowIdsOf = (model: { rows: { id: string }[] }) =>
    model.rows.map(row => row.id)

  it('TY1: встроенный тип object: значение — запись; getKey и getLabel у типа или колонки; по умолчанию ключ — поле id, подпись — label, иначе name, иначе ключ строкой; запись без ключа — предупреждение в dev, раз на колонку', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const table = tableWith(
      [
        { id: 'plain', accessorKey: 'v', dataType: 'object' },
        { id: 'person', accessorKey: 'v', dataType: 'person' },
        {
          id: 'own',
          accessorKey: 'v',
          dataType: 'person',
          getLabel: (value: { uid: string }) => `#${value.uid}`,
        },
      ],
      {
        dataTypes: {
          person: {
            extends: 'object',
            getKey: (value: { uid: string }) => value.uid,
            getLabel: (value: { first: string; last: string }) =>
              `${value.first} ${value.last}`,
          },
        },
      },
    )
    const keyOf = (columnId: string, value: unknown) =>
      objectKeyOf(table, table.getColumn(columnId), value)

    expect(table.getColumn('plain').getDataType().base).toBe('object')
    expect(keyOf('plain', { id: 7, label: 'Seven', name: 'x' })).toBe(7)
    expect(textOf(table, 'plain', { id: 7, label: 'Seven', name: 'x' })).toBe(
      'Seven',
    )
    expect(textOf(table, 'plain', { id: 7, name: 'Ann' })).toBe('Ann')
    expect(textOf(table, 'plain', { id: 7 })).toBe('7')

    // Ключ и подпись типа; поле колонки главнее поля типа.
    const person = { uid: 'u1', first: 'Ann', last: 'Lee' }
    expect(keyOf('person', person)).toBe('u1')
    expect(textOf(table, 'person', person)).toBe('Ann Lee')
    expect(keyOf('own', person)).toBe('u1')
    expect(textOf(table, 'own', person)).toBe('#u1')

    // Запись без ключа — одно предупреждение на колонку.
    keyOf('plain', { name: 'x' })
    keyOf('plain', { name: 'y' })
    const warnings = warn.mock.calls
      .map(call => String(call[0]))
      .filter(text => text.includes('record without a key'))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('"plain"')
  })

  it('TY3: сортировка записи — по подписи через Intl.Collator языка, пустые в конце при обоих направлениях', () => {
    const table = hostTable({
      data: [
        { id: 'a', m: { id: 2, name: 'bob' } },
        { id: 'b', m: { id: 1, name: 'Alice' } },
        { id: 'c', m: null },
        { id: 'd', m: { id: 3, name: 'carl 10' } },
        { id: 'e', m: { id: 4, name: 'Carl 9' } },
      ],
      getRowId: (row: { id: string }) => row.id,
      columns: [{ id: 'm', accessorKey: 'm', dataType: 'object' }],
      plugins: [columnSorting()],
    }) as any
    const sorted = (desc: boolean) => {
      table.setSorting([{ id: 'm', desc }])
      return rowIdsOf(table.getSortedRowModel())
    }
    expect(sorted(false)).toEqual(['b', 'a', 'e', 'd', 'c'])
    expect(sorted(true)).toEqual(['d', 'e', 'a', 'b', 'c'])
  })

  it('TY4: фильтр записи — список с флажками по подписям: варианты — уникальные ключи из данных, счётчики — по ключу, справочник — loadOptions колонки или типа; срез хранит ключи и сериализуем', () => {
    const table = managers([columnFiltering()])
    const column = table.getColumn('m')
    expect(columnFilterDefOf(column)).toMatchObject({ type: 'select' })
    expect(filterOptionsOf(table, column)).toEqual([
      { value: 1, label: 'Ann' },
      { value: 2, label: 'Bob' },
    ])
    expect([...optionCountsOf(table, column)!]).toEqual([
      [1, 2],
      [2, 1],
    ])
    table.setColumnFilters([
      { id: 'm', value: { operator: 'anyOf', value: [1] } },
    ])
    expect(rowIdsOf(table.getFilteredRowModel())).toEqual(['a', 'b'])
    const state = table.atoms.columnFilters.get()
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)

    const load = async () => []
    const lookups = tableWith(
      [
        { id: 'own', accessorKey: 'm', dataType: 'object', loadOptions: load },
        { id: 'typed', accessorKey: 'm', dataType: 'manager' },
      ],
      { dataTypes: { manager: { extends: 'object', loadOptions: load } } },
    )
    for (const id of ['own', 'typed']) {
      expect(columnFilterDefOf(lookups.getColumn(id))).toMatchObject({
        type: 'lookup',
        loadOptions: load,
      })
    }
  })

  it('TY6: группировка по колонке записи — по ключу: разные объекты с одним ключом — одна группа, строка группы показывает подпись', () => {
    const table = managers([rowGrouping()])
    table.setGrouping(['m'])
    const groups = table.getGroupedRowModel().rows
    expect(groups).toHaveLength(3)
    expect(groups[0].subRows.map((row: { id: string }) => row.id)).toEqual([
      'a',
      'b',
    ])
    expect(textOf(table, 'm', groups[0].getValue('m'))).toBe('Ann')
    expect(textOf(table, 'm', groups[1].getValue('m'))).toBe('Bob')
  })

  it('TY7: поиск, сводка фильтров, CSV и xlsx — подписью записи', async () => {
    const table = managers([columnFiltering(), quickSearch()])
    table.setGlobalFilter('ann')
    expect(rowIdsOf(table.getFilteredRowModel())).toEqual(['a', 'b'])
    table.setGlobalFilter('')

    // Сводка фильтров называет отмеченные ключи подписями.
    expect(filterOptionLabelOf(table, table.getColumn('m'), 2)).toBe('Bob')

    const data = collectExportData(table)
    expect(csvFormat().serialize(data).split(/\r?\n/).slice(1, 4)).toEqual([
      'Ann',
      'Ann',
      'Bob',
    ])
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(
      (await (await buildXlsx(data)).arrayBuffer()) as never,
    )
    const cell = workbook.worksheets[0]!.getRow(4).getCell(1)
    expect(cell.type).toBe(ExcelJS.ValueType.String)
    expect(cell.value).toBe('Bob')
  })
})

describe('тип numberString (ADR 0174, этап 2)', () => {
  /** Суммы строками: «a» и «b» во float неотличимы. */
  const AMOUNTS = [
    { id: 'a', amount: '12345678901234567.89' },
    { id: 'b', amount: '12345678901234567.88' },
    { id: 'c', amount: '-0' },
    { id: 'd', amount: '0.5' },
    { id: 'e', amount: '-1.25' },
    { id: 'f', amount: '007' },
    { id: 'g', amount: 'abc' },
    { id: 'h', amount: null },
    { id: 'i', amount: '10' },
    { id: 'j', amount: '9.999' },
  ]
  const amounts = (plugins: unknown[], data = AMOUNTS) =>
    hostTable({
      data,
      getRowId: (row: { id: string }) => row.id,
      columns: [
        {
          id: 'amount',
          accessorKey: 'amount',
          header: 'Amount',
          dataType: 'numberString',
        },
      ],
      timeZone: 'UTC',
      plugins,
    }) as any
  const idsOf = (model: { rows: { id: string }[] }) =>
    model.rows.map(row => row.id)

  it('TY10: сортировка numberString — десятичным сравнением строк без перевода во float: значения, неотличимые во float, упорядочены верно; знак, ведущие нули и "-0" — по значению; нечисловая строка и пусто — в конце', () => {
    expect(Number(AMOUNTS[0]!.amount)).toBe(Number(AMOUNTS[1]!.amount))
    const table = amounts(
      [columnSorting()],
      [
        ...AMOUNTS,
        { id: 'k', amount: '-1.25001' },
        { id: 'l', amount: '0.50001' },
        { id: 'm', amount: '0.50000' },
      ],
    )
    const sorted = (desc: boolean) => {
      table.setSorting([{ id: 'amount', desc }])
      return idsOf(table.getSortedRowModel())
    }
    expect(sorted(false)).toEqual([
      'k',
      'e',
      'c',
      'd',
      'm',
      'l',
      'f',
      'j',
      'i',
      'b',
      'a',
      'g',
      'h',
    ])
    expect(sorted(true)).toEqual([
      'a',
      'b',
      'i',
      'j',
      'f',
      'l',
      'd',
      'm',
      'c',
      'e',
      'k',
      'g',
      'h',
    ])
  })

  it('TY11: фильтр numberString — числовой: ввод по языку таблицы, сравнение десятичное без float', () => {
    const table = amounts([columnFiltering()])
    expect(columnFilterDefOf(table.getColumn('amount'))).toMatchObject({
      type: 'number',
    })
    const filtered = (value: unknown) => {
      table.setColumnFilters([{ id: 'amount', value }])
      return idsOf(table.getFilteredRowModel())
    }
    // Граница из ввода по языку — та же десятичная строка, что панель кладёт в срез.
    const bound = parseLocaleDecimal('12 345 678 901 234 567,88', 'ru-RU')
    expect(bound).toBe('12345678901234567.88')
    expect(filtered({ operator: 'greaterThan', value: bound })).toEqual(['a'])
    expect(filtered({ operator: 'equals', value: bound })).toEqual(['b'])
    expect(filtered({ operator: 'equals', value: '7' })).toEqual(['f'])
    expect(filtered({ operator: 'between', value: ['-1.25', '0.5'] })).toEqual([
      'c',
      'd',
      'e',
    ])
    expect(filtered({ operator: 'lessThan', value: 0 })).toEqual(['e'])
  })

  it('TY13: выгрузка numberString: CSV — строкой как есть; xlsx — числом до 15 значащих цифр, длиннее — текстом', async () => {
    const table = hostTable({
      data: [
        { id: 'a', amount: '1234.50' },
        { id: 'b', amount: '12345678901234567.89' },
      ],
      getRowId: (row: { id: string }) => row.id,
      columns: [
        {
          id: 'amount',
          accessorKey: 'amount',
          header: 'Amount',
          dataType: 'numberString',
        },
      ],
    }) as any
    const data = collectExportData(table)
    expect(csvFormat().serialize(data).split(/\r?\n/).slice(1, 3)).toEqual([
      '1234.50',
      '12345678901234567.89',
    ])
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(
      (await (await buildXlsx(data)).arrayBuffer()) as never,
    )
    const sheet = workbook.worksheets[0]!
    const short = sheet.getRow(2).getCell(1)
    const long = sheet.getRow(3).getCell(1)
    expect(short.type).toBe(ExcelJS.ValueType.Number)
    expect(short.value).toBe(1234.5)
    expect(long.type).toBe(ExcelJS.ValueType.String)
    expect(long.value).toBe('12345678901234567.89')
  })
})
