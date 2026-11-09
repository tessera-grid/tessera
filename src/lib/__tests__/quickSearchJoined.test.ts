/**
 * Быстрый поиск по склеенному тексту строки (ADR 0201): тот же отбор, что по колонкам, текст
 * раз на строку, его сброс, путь по колонкам, общий форматтер и общие вердикты строки.
 * Запуск: npx vitest run --project unit quickSearchJoined
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { columnFormatter, formatDataTypeValue } from '../core/dataTypeFormat'
import { columnFiltering, columnVisibility, quickSearch } from '../plugins'
import {
  normalizeSearch,
  quickSearchFilter,
} from '../plugins/quickSearchModel/search'
import { __resetLogger } from '../util/logger'
import { hostTable } from './tableHost'

afterEach(() => {
  __resetLogger()
  vi.restoreAllMocks()
})

const STATUS = [
  { value: 'a', label: 'Active' },
  { value: 'z', label: 'Archived' },
]

interface Item {
  id: string
  price: number
  day: string
  at: string
  status: string
  flag: boolean
  note: unknown
  code: number
  hidden: string
  skipped: string
}

const DATA: Item[] = [
  {
    id: 'a',
    price: 1234.5,
    day: '2026-10-31',
    at: '2026-10-31T14:05:00Z',
    status: 'z',
    flag: true,
    note: { text: 'object' },
    code: 7,
    hidden: 'secret',
    skipped: 'quiet',
  },
  {
    id: 'b',
    price: 18.9,
    day: '2026-01-02',
    at: '2026-01-02T09:00:00Z',
    status: 'a',
    flag: false,
    note: 'plain note',
    code: 8,
    hidden: 'other',
    skipped: 'loud',
  },
  {
    id: 'c',
    price: 0,
    day: '',
    at: '2026-03-04T23:30:00Z',
    status: '',
    flag: true,
    note: null,
    code: 42,
    hidden: '',
    skipped: '',
  },
]

const COLUMNS = [
  { id: 'price', accessorKey: 'price', dataType: 'money' },
  { id: 'day', accessorKey: 'day', dataType: 'dateString' },
  { id: 'at', accessorKey: 'at', dataType: 'dateTimeString' },
  { id: 'status', accessorKey: 'status', dataType: 'select', options: STATUS },
  { id: 'flag', accessorKey: 'flag', dataType: 'boolean' },
  { id: 'note', accessorKey: 'note' },
  { id: 'code', accessorKey: 'code', dataType: 'tag' },
  { id: 'hidden', accessorKey: 'hidden' },
  { id: 'skipped', accessorKey: 'skipped', enableGlobalFilter: false },
]

/** Таблица с поиском; `globalFilterFn` — своя функция поиска плагином автора. */
const tableOf = (
  { globalFilterFn, ...params }: Record<string, unknown> = {},
  shown = vi.fn((value: unknown) => `#${value}`),
) => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const table = hostTable({
    data: DATA,
    columns: COLUMNS,
    getRowId: (row: { id: string }) => row.id,
    dataTypes: {
      money: {
        extends: 'number',
        format: { style: 'currency', currency: 'USD' },
      },
      tag: { extends: 'text', formatValue: shown },
    },
    timeZone: 'UTC',
    plugins: [
      quickSearch(),
      columnFiltering(),
      columnVisibility(),
      ...(globalFilterFn
        ? [{ id: 'ownSearch', options: { globalFilterFn } }]
        : []),
    ],
    ...params,
  }) as any
  table.setColumnVisibility({ hidden: false })
  return table
}

const found = (table: any, query: string) => {
  table.setGlobalFilter(query)
  return table.getFilteredRowModel().rows.map((row: { id: string }) => row.id)
}

/** Отбор проверкой каждой колонки поиска — прежний путь, эталон. */
const byColumns = (table: any, query: string) => {
  const value = normalizeSearch(query)
  const columns = table
    .getAllLeafColumns()
    .filter((column: any) => column.getCanGlobalFilter())
  return table
    .getCoreRowModel()
    .rows.filter((row: any) =>
      columns.some((column: any) =>
        (quickSearchFilter as any)(row, column.id, value),
      ),
    )
    .map((row: { id: string }) => row.id)
}

/** Функция поиска плагина, вызовы которой по колонкам видны тесту. */
const spiedSearch = () =>
  Object.assign(
    vi.fn((...args: unknown[]) => (quickSearchFilter as any)(...args)),
    {
      resolveFilterValue: (quickSearchFilter as any).resolveFilterValue,
      prepareRowCheck: (quickSearchFilter as any).prepareRowCheck,
    },
  )

describe('склеенный текст строки (ADR 0201)', () => {
  it('QT1: поиск по склеенному тексту строки даёт тот же отбор, что проверка каждой колонки поиска: формат типа, подписи вариантов, даты, колонка без типа с нетекстовым значением; булевы, служебные и исключённые колонки вне поиска', () => {
    const table = tableOf()
    const cases: [string, string[]][] = [
      ['$1,234.50', ['a']],
      ['1234.5', []],
      ['archived', ['a']],
      ['2026-10-31 14:05', ['a']],
      ['2026-03-04 23:30', ['c']],
      ['plain', ['b']],
      ['object', []],
      ['true', []],
      ['#42', ['c']],
      ['secret', []],
      ['quiet', []],
      ['  ARCHIVED ', ['a']],
      ['2026', ['a', 'b', 'c']],
    ]
    for (const [query, ids] of cases) {
      expect(found(table, query), query).toEqual(ids)
      expect(byColumns(table, query), query).toEqual(ids)
    }
  })

  it('QT2: запрос не находится на стыке двух колонок', () => {
    const table = hostTable({
      data: [{ id: 'r', left: 'ab', right: 'cd' }],
      columns: [
        { id: 'left', accessorKey: 'left' },
        { id: 'right', accessorKey: 'right' },
      ],
      getRowId: (row: { id: string }) => row.id,
      plugins: [quickSearch()],
    }) as any
    expect(found(table, 'bc')).toEqual([])
    expect(found(table, 'b')).toEqual(['r'])
    expect(found(table, 'cd')).toEqual(['r'])
  })

  it('QT3: текст строки считается один раз: повторный запрос не форматирует значения и не зовёт getValue, а функцию поиска по колонкам не зовёт ни один запрос', () => {
    const shown = vi.fn((value: unknown) => `#${value}`)
    const search = spiedSearch()
    const table = tableOf({ globalFilterFn: search }, shown)
    expect(found(table, '#8')).toEqual(['b'])
    expect(shown).toHaveBeenCalledTimes(DATA.length)
    const getValue = vi.fn()
    for (const row of table.getCoreRowModel().rows) {
      const own = row.getValue.bind(row)
      row.getValue = (id: string) => {
        getValue(id)
        return own(id)
      }
    }
    expect(found(table, '#7')).toEqual(['a'])
    expect(found(table, 'archived')).toEqual(['a'])
    expect(shown).toHaveBeenCalledTimes(DATA.length)
    expect(getValue).not.toHaveBeenCalled()
    expect(search).not.toHaveBeenCalled()
  })

  it('QT4: текст строки пересчитывается при смене данных строки, набора колонок поиска, columnDef колонки, locale, timeZone и реестра dataTypes; без этих смен — не пересчитывается', () => {
    const shown = vi.fn((value: unknown) => `#${value}`)
    const table = tableOf({}, shown)
    const calls = () => shown.mock.calls.length
    const set = (patch: (prev: any) => object) =>
      table.setOptions((prev: any) => ({ ...prev, ...patch(prev) }))
    found(table, '#')
    expect(calls()).toBe(3)

    // Без смен: другой запрос и новый объект опций с теми же значениями — тексты из кэша.
    found(table, '#4')
    set(() => ({}))
    found(table, '#8')
    expect(calls()).toBe(3)

    // Данные одной строки — пересчёт только её текста.
    const edited = DATA.map(row => (row.id === 'b' ? { ...row, code: 9 } : row))
    set(() => ({ data: edited }))
    expect(found(table, '#9')).toEqual(['b'])
    expect(calls()).toBe(4)

    // Набор колонок поиска: скрытая колонка ушла из поиска.
    table.setColumnVisibility({ price: false, hidden: false })
    expect(found(table, '$1,234.50')).toEqual([])
    expect(calls()).toBe(7)

    // columnDef колонки, язык, пояс и реестр типов.
    set(prev => ({
      columns: prev.columns.map((column: any) =>
        column.id === 'note' ? { ...column } : column,
      ),
    }))
    found(table, '#')
    expect(calls()).toBe(10)
    set(() => ({ locale: 'ru-RU' }))
    found(table, '#7')
    expect(calls()).toBe(13)
    set(() => ({ timeZone: 'Asia/Tokyo' }))
    expect(found(table, '2026-03-05 08:30')).toEqual(['c'])
    expect(calls()).toBe(16)
    set(prev => ({ dataTypes: { ...prev.dataTypes } }))
    found(table, '#4')
    expect(calls()).toBe(19)
  })

  it('QT5: запрос с символом U+0000 проверяется по каждой колонке; своя globalFilterFn без prepareRowCheck — тоже, с addMeta', () => {
    const search = spiedSearch()
    const table = tableOf({ globalFilterFn: search })
    const query = 'plain\u0000note'
    expect(found(table, query)).toEqual(byColumns(table, query))
    expect(search).toHaveBeenCalled()

    const own = Object.assign(
      vi.fn(
        (
          row: any,
          columnId: string,
          value: string,
          addMeta: (meta: unknown) => void,
        ) => {
          const hit = String(row.getValue(columnId)).includes(value)
          if (hit) addMeta({ columnId })
          return hit
        },
      ),
      { resolveFilterValue: (value: unknown) => value },
    )
    const custom = tableOf({ globalFilterFn: own })
    expect(found(custom, 'plain')).toEqual(['b'])
    expect(own).toHaveBeenCalled()
    const b = custom.getCoreRowModel().rowsById.b
    expect(b.columnFiltersMeta.note).toEqual({ columnId: 'note' })
  })

  it('QT6: форматтер колонки и formatDataTypeValue дают один текст для всех баз типов, подписей вариантов, formatValue и колонки без типа', () => {
    const table = {
      options: {
        locale: 'de-DE',
        timeZone: 'Europe/Berlin',
        dataTypes: {
          money: {
            extends: 'number',
            format: { style: 'currency', currency: 'EUR' },
          },
          stamp: { extends: 'dateTime', format: { dateStyle: 'medium' } },
          shout: {
            extends: 'text',
            formatValue: (value: unknown) => `${value}!`,
          },
        },
      },
    } as any
    const values = [
      1234.5,
      '1234.50',
      '2026-10-31',
      '2026-10-31T14:05:00Z',
      new Date(Date.UTC(2026, 0, 2, 9)),
      ['a', 'z'],
      { id: 7, name: 'Seven' },
      'a',
      '',
      null,
      undefined,
      true,
    ]
    const defs = [
      { dataType: 'number' },
      { dataType: 'number', format: { maximumFractionDigits: 0 } },
      { dataType: 'money' },
      { dataType: 'numberString', format: { minimumFractionDigits: 3 } },
      { dataType: 'date' },
      { dataType: 'dateTime' },
      { dataType: 'dateString' },
      { dataType: 'dateTimeString' },
      { dataType: 'stamp' },
      { dataType: 'select', options: STATUS },
      { dataType: 'multiSelect', options: STATUS },
      { dataType: 'object' },
      { dataType: 'boolean' },
      { dataType: 'shout' },
      { options: STATUS },
      {},
    ]
    defs.forEach((columnDef, i) => {
      const column = { id: `c${i}`, columnDef } as any
      const format = columnFormatter(table, column)
      for (const value of values) {
        expect(format(value, {}), `${JSON.stringify(columnDef)}`).toBe(
          formatDataTypeValue(table, column, value, {}),
        )
      }
    })
  })

  it('QT7: при одном поиске строки ссылаются на общие замороженные вердикты и общий пустой columnFiltersMeta; с фильтром колонки у строки свои объекты', () => {
    const table = tableOf()
    found(table, 'plain')
    const rows = table.getCoreRowModel().rows
    const [a, b, c] = rows
    expect(a.columnFilters).toEqual({ __global__: false })
    expect(b.columnFilters).toEqual({ __global__: true })
    expect(a.columnFilters).toBe(c.columnFilters)
    expect(Object.isFrozen(a.columnFilters)).toBe(true)
    expect(Object.isFrozen(b.columnFilters)).toBe(true)
    for (const row of rows) {
      expect(row.columnFiltersMeta).toBe(a.columnFiltersMeta)
      expect(Object.isFrozen(row.columnFiltersMeta)).toBe(true)
      expect(Object.keys(row.columnFiltersMeta)).toEqual([])
    }
    table.setColumnFilters([
      { id: 'note', value: { operator: 'contains', value: 'note' } },
    ])
    const filtered = table
      .getFilteredRowModel()
      .rows.map((row: { id: string }) => row.id)
    expect(filtered).toEqual(['b'])
    const [a2, b2, c2] = table.getCoreRowModel().rows
    expect(b2.columnFilters).toEqual({ note: true, __global__: true })
    expect(a2.columnFilters).not.toBe(c2.columnFilters)
    expect(Object.isFrozen(b2.columnFilters)).toBe(false)
  })
})
