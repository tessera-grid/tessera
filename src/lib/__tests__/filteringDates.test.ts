/**
 * Headless-проверки фильтра дат (ADR 0047): разбор значений ячеек, условия, пресеты,
 * часовой пояс, сериализуемый срез, быстрый поиск и экспорт.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { columnFiltering } from '../plugins/columnFiltering'
import type { ColumnFilterValue } from '../plugins/columnFiltering'
import { dataExport } from '../plugins/dataExport'
import { exportRowsOf } from '../plugins/dataExport/exportData'
import { quickSearch } from '../plugins/quickSearch'

interface Item {
  id: string
  name: string
  day: string | null
  created: unknown
  closed?: string
}

const DATA: Item[] = [
  {
    id: 'a',
    name: 'Alpha 2026',
    day: '2026-10-03',
    created: '2026-10-03T22:30:00Z',
    closed: '03.10.2026',
  },
  {
    id: 'b',
    name: 'Bravo',
    day: '2026-10-04',
    created: new Date(Date.UTC(2026, 9, 4, 9, 15)),
    closed: '04.10.2026',
  },
  {
    id: 'c',
    name: 'Charlie',
    day: '2026-02-28',
    created: Date.UTC(2026, 1, 28, 12, 0),
    closed: 'unknown',
  },
  { id: 'd', name: 'Delta', day: null, created: 'garbage' },
  { id: 'e', name: 'Echo', day: '', created: '2026-10-03T14:30' },
  {
    id: 'f',
    name: 'Foxtrot',
    day: '2026-13-01',
    created: new Date(Number.NaN),
  },
]

/** `'dd.mm.yyyy'` → ISO-день; остальное — как есть. */
const parseDotted = (value: unknown) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(value ?? ''))
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'day', accessorKey: 'day', header: 'Day', filter: 'date' },
  {
    id: 'created',
    accessorKey: 'created',
    header: 'Created',
    filter: 'datetime',
  },
  {
    id: 'closed',
    accessorKey: 'closed',
    header: 'Closed',
    filter: { type: 'date', parse: parseDotted },
  },
]

const build = (
  plugins: any[] = [columnFiltering({ timeZone: 'UTC' })],
  data: object[] = DATA,
) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...plugins,
  ]
  const folded = foldEntries(entries)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data,
    columns: injectServiceColumns(COLUMNS as any[], folded.serviceColumns),
    getRowId: (row: Item) => row.id,
    ...folded.options,
    hooks: resolveHooks(foldHooks(entries)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
  } as never) as any
}

const ids = (table: any): string[] =>
  table.getRowModel().rows.map((row: { id: string }) => row.id)

const filtered = (
  columnId: string,
  filter: ColumnFilterValue,
  timeZone: string | null = 'UTC',
) => {
  // null — без timeZone, в поясе среды.
  const table = build([columnFiltering({ timeZone: timeZone ?? undefined })])
  table.setColumnFilters([{ id: columnId, value: filter }])
  return ids(table)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('columnFiltering — значения дат', () => {
  it("DF2: ячейка — Date, миллисекунды или ISO; 'YYYY-MM-DD' — календарный день без сдвига в UTC; ISO без смещения — стенное время timeZone; parse — свой формат", () => {
    // Календарный день не сдвигается и к западу от UTC, где new Date('2026-10-03') — 2 октября.
    for (const timeZone of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
      expect(
        filtered('day', { operator: 'on', value: '2026-10-03' }, timeZone),
      ).toEqual(['a'])
    }
    // Date и миллисекунды — моменты.
    expect(
      filtered('created', { operator: 'on', value: '2026-10-04' }),
    ).toEqual(['b'])
    expect(
      filtered('created', { operator: 'on', value: '2026-02-28' }),
    ).toEqual(['c'])
    // ISO со смещением — момент: в Токио 22:30Z — уже 4 октября; ISO без смещения —
    // стенное время пояса и остаётся 3 октября.
    expect(
      filtered('created', { operator: 'on', value: '2026-10-03' }, 'UTC'),
    ).toEqual(['a', 'e'])
    expect(
      filtered(
        'created',
        { operator: 'on', value: '2026-10-03' },
        'Asia/Tokyo',
      ),
    ).toEqual(['e'])
    // Свой формат через parse.
    expect(filtered('closed', { operator: 'on', value: '2026-10-03' })).toEqual(
      ['a'],
    )
    expect(
      filtered('closed', { operator: 'after', value: '2026-10-03' }),
    ).toEqual(['b'])
  })

  it("DF3: неразбираемое значение, null, undefined, '' — пустое: проходит «пусто», не проходит остальные условия", () => {
    // day: null, '', несуществующая дата; created: строка-мусор, Invalid Date.
    expect(filtered('day', { operator: 'empty' })).toEqual(['d', 'e', 'f'])
    expect(filtered('day', { operator: 'notEmpty' })).toEqual(['a', 'b', 'c'])
    expect(filtered('created', { operator: 'empty' })).toEqual(['d', 'f'])
    // undefined и неразобранное parse.
    expect(filtered('closed', { operator: 'empty' })).toEqual([
      'c',
      'd',
      'e',
      'f',
    ])
    for (const filter of [
      { operator: 'before', value: '2100-01-01' },
      { operator: 'after', value: '1900-01-01' },
      { operator: 'between', value: ['1900-01-01', '2100-01-01'] },
    ] as ColumnFilterValue[]) {
      expect(filtered('day', filter)).toEqual(['a', 'b', 'c'])
      expect(filtered('created', filter)).toEqual(['a', 'b', 'c', 'e'])
    }
  })

  it('DF4: значение фильтра в columnFilters — ISO-строки и имя пресета, без Date; срез переживает JSON.stringify / JSON.parse без потерь', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 4, 10)))
    const filters = [
      {
        id: 'day',
        value: { operator: 'between', value: ['2026-01-01', null] },
      },
      { id: 'created', value: { operator: 'preset', value: 'last7Days' } },
    ]
    const table = build()
    table.setColumnFilters(filters)
    const state = table.atoms.columnFilters.get()
    const json = JSON.stringify(state)
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T[^"]*Z/)
    const restored = JSON.parse(json)
    expect(restored).toEqual(state)

    const again = build()
    again.setColumnFilters(restored)
    expect(ids(again)).toEqual(ids(table))
    expect(ids(table)).toEqual(['a', 'b'])
  })
})

describe('columnFiltering — условия дат', () => {
  it('DF5: date: «в день», «до», «после» (строго), «между» (включительно, пустая граница — открытый интервал), «пусто», «не пусто»', () => {
    expect(filtered('day', { operator: 'on', value: '2026-10-04' })).toEqual([
      'b',
    ])
    expect(
      filtered('day', { operator: 'before', value: '2026-10-03' }),
    ).toEqual(['c'])
    expect(filtered('day', { operator: 'after', value: '2026-10-03' })).toEqual(
      ['b'],
    )
    expect(
      filtered('day', {
        operator: 'between',
        value: ['2026-10-03', '2026-10-04'],
      }),
    ).toEqual(['a', 'b'])
    expect(
      filtered('day', { operator: 'between', value: [null, '2026-10-03'] }),
    ).toEqual(['a', 'c'])
    expect(
      filtered('day', { operator: 'between', value: ['2026-10-04', null] }),
    ).toEqual(['b'])
    expect(filtered('day', { operator: 'empty' })).toEqual(['d', 'e', 'f'])
    expect(filtered('day', { operator: 'notEmpty' })).toEqual(['a', 'b', 'c'])

    // Пустые и неразбираемые границы фильтром не считаются — срез их не хранит.
    const table = build()
    table.setColumnFilters([
      { id: 'day', value: { operator: 'between', value: [null, null] } },
      { id: 'created', value: { operator: 'on', value: '' } },
    ])
    expect(table.atoms.columnFilters.get()).toEqual([])
    expect(ids(table)).toHaveLength(DATA.length)
  })

  it('DF6: пресеты «сегодня», «вчера», «последние 7 / 30 дней», «этот месяц», «этот год» хранятся пресетом и считаются от «сегодня» в момент применения', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 10, 10)))
    const days = {
      today: '2026-10-10',
      yesterday: '2026-10-09',
      d6: '2026-10-04',
      d7: '2026-10-03',
      d29: '2026-09-11',
      d30: '2026-09-10',
      monthStart: '2026-10-01',
      yearStart: '2026-01-01',
      lastYear: '2025-12-31',
      tomorrow: '2026-10-11',
    }
    const data = Object.entries(days).map(([id, day]) => ({
      id,
      name: id,
      day,
      created: null,
    }))
    const preset = (value: string) => {
      const table = build(undefined, data)
      table.setColumnFilters([
        { id: 'day', value: { operator: 'preset', value } },
      ])
      expect(table.atoms.columnFilters.get()[0].value).toEqual({
        operator: 'preset',
        value,
      })
      return ids(table).sort()
    }
    expect(preset('today')).toEqual(['today'])
    expect(preset('yesterday')).toEqual(['yesterday'])
    expect(preset('last7Days')).toEqual(['d6', 'today', 'yesterday'])
    expect(preset('last30Days')).toEqual(
      ['d29', 'd6', 'd7', 'monthStart', 'today', 'yesterday'].sort(),
    )
    expect(preset('thisMonth')).toEqual(
      ['d6', 'd7', 'monthStart', 'today', 'tomorrow', 'yesterday'].sort(),
    )
    expect(preset('thisYear')).toEqual(
      Object.keys(days)
        .filter(id => id !== 'lastYear')
        .sort(),
    )

    // Тот же сохранённый пресет назавтра отбирает завтрашние строки.
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 11, 10)))
    expect(preset('today')).toEqual(['tomorrow'])
    expect(preset('yesterday')).toEqual(['today'])
  })

  it('DF7: datetime: «в день» сравнивает календарный день; «до», «после», «между» — с точностью до минуты', () => {
    const data = [
      { id: 'early', created: '2026-10-03T00:00:00Z' },
      { id: 'm29', created: '2026-10-03T14:29:59Z' },
      { id: 'm30', created: '2026-10-03T14:30:20Z' },
      { id: 'm31', created: '2026-10-03T14:31:00Z' },
      { id: 'late', created: '2026-10-03T23:59:59Z' },
      { id: 'next', created: '2026-10-04T00:00:00Z' },
    ].map(row => ({ ...row, name: row.id, day: null }))
    const run = (filter: ColumnFilterValue) => {
      const table = build(undefined, data)
      table.setColumnFilters([{ id: 'created', value: filter }])
      return ids(table)
    }
    expect(run({ operator: 'on', value: '2026-10-03' })).toEqual([
      'early',
      'm29',
      'm30',
      'm31',
      'late',
    ])
    // «В день» со временем в значении — тоже весь день.
    expect(run({ operator: 'on', value: '2026-10-03T14:30' })).toHaveLength(5)
    expect(run({ operator: 'before', value: '2026-10-03T14:30' })).toEqual([
      'early',
      'm29',
    ])
    expect(run({ operator: 'after', value: '2026-10-03T14:30' })).toEqual([
      'm31',
      'late',
      'next',
    ])
    expect(
      run({
        operator: 'between',
        value: ['2026-10-03T14:30', '2026-10-03T14:31'],
      }),
    ).toEqual(['m30', 'm31'])
  })

  it('DF8: сутки, «сегодня», пресеты и стенное время datetime считаются в timeZone, без него — в поясе браузера; один момент даёт разные дни в двух поясах; date не сдвигается', () => {
    const on3 = { operator: 'on', value: '2026-10-03' } as ColumnFilterValue
    const on4 = { operator: 'on', value: '2026-10-04' } as ColumnFilterValue
    // a — 2026-10-03T22:30Z: в Лондоне 23:30 3-го, в Москве 01:30 4-го.
    expect(filtered('created', on3, 'Europe/London')).toEqual(['a', 'e'])
    expect(filtered('created', on3, 'Europe/Moscow')).toEqual(['e'])
    expect(filtered('created', on4, 'Europe/Moscow')).toEqual(['a', 'b'])
    // date не зависит от пояса.
    expect(filtered('day', on3, 'Europe/London')).toEqual(['a'])
    expect(filtered('day', on3, 'Europe/Moscow')).toEqual(['a'])

    // Без timeZone — пояс среды.
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(filtered('created', on3, null)).toEqual(
      filtered('created', on3, local),
    )

    // «Сегодня» — в поясе: в 22:30Z в Москве уже 4-е.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 3, 22, 30)))
    const today = { operator: 'preset', value: 'today' } as ColumnFilterValue
    expect(filtered('created', today, 'Europe/London')).toEqual(['a', 'e'])
    expect(filtered('created', today, 'Europe/Moscow')).toEqual(['a', 'b'])

    // Смена пояса на живой таблице пересчитывает фильтр.
    const table = build([columnFiltering({ timeZone: 'Europe/London' })])
    table.setColumnFilters([{ id: 'created', value: on3 }])
    expect(ids(table)).toEqual(['a', 'e'])
    table.setOptions((prev: object) => ({
      ...prev,
      columnFilteringTimeZone: 'Europe/Moscow',
    }))
    expect(ids(table)).toEqual(['e'])
  })
})

describe('даты и соседние плагины', () => {
  it('DF18: быстрый поиск не обходит колонки date и datetime', () => {
    const table = build([columnFiltering({ timeZone: 'UTC' }), quickSearch()])
    expect(table.getColumn('day').getCanGlobalFilter()).toBe(false)
    expect(table.getColumn('created').getCanGlobalFilter()).toBe(false)
    expect(table.getColumn('closed').getCanGlobalFilter()).toBe(false)
    expect(table.getColumn('name').getCanGlobalFilter()).toBe(true)
    // «2026» есть в каждой дате, но строку находит только имя.
    table.setGlobalFilter('2026')
    expect(ids(table)).toEqual(['a'])
    table.setGlobalFilter('10')
    expect(ids(table)).toEqual([])
  })

  it('DF20: экспорт view учитывает фильтр дат', () => {
    const table = build([columnFiltering({ timeZone: 'UTC' }), dataExport()])
    const view = () => exportRowsOf(table, 'view').map(row => row.id)
    expect(view()).toHaveLength(DATA.length)
    table.setColumnFilters([
      {
        id: 'day',
        value: { operator: 'between', value: ['2026-10-01', null] },
      },
    ])
    expect(view()).toEqual(['a', 'b'])
  })
})
