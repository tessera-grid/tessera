/**
 * Детерминированные данные и колонки для фильтрации (ADR 0045): текст, число,
 * булево с пустыми значениями и колонка без фильтра.
 */
import type { ColumnDef } from '@tanstack/react-table'

export interface FilteringItem {
  id: string
  name: string
  city: string
  age: number | null
  vip: boolean | null
  visits: number
}

const NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank', 'Grace']
const CITIES = ['Paris', 'Berlin', 'Rome', 'Oslo', 'Lima']

export const makeFilteringData = (count = 60): FilteringItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-id-${i}`,
    name: `${NAMES[i % NAMES.length]} ${i}`,
    city: CITIES[i % CITIES.length],
    age: i % 11 === 10 ? null : 18 + ((i * 7) % 50),
    vip: i % 9 === 8 ? null : i % 3 === 0,
    visits: i % 20,
  }))

export const filteringData = makeFilteringData()

export const filteringColumns: ColumnDef<any, any>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 160,
    filter: 'text',
  },
  {
    id: 'city',
    accessorKey: 'city',
    header: 'City',
    size: 140,
    filter: 'text',
  },
  { id: 'age', accessorKey: 'age', header: 'Age', size: 120, filter: 'number' },
  {
    id: 'vip',
    accessorKey: 'vip',
    header: 'VIP',
    size: 120,
    filter: { type: 'boolean', nullable: true },
    cell: ({ getValue }) => {
      const value = getValue()
      return value === null ? '—' : value ? 'Yes' : 'No'
    },
  },
  { id: 'visits', accessorKey: 'visits', header: 'Visits', size: 120 },
] as ColumnDef<any, any>[]

export interface DateFilteringItem {
  id: string
  name: string
  birthDate: string | null
  createdAt: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Начало прошлой минуты: данные историй не зависят от момента между рендерами. */
const MINUTE = 60_000

/**
 * Даты для фильтра дат (ADR 0047): `birthDate` — календарные дни (каждый 13-й пуст),
 * `createdAt` — моменты ISO. Первые 20 строк — 2026-03-15 через каждые 3 часа UTC:
 * у границы суток смена пояса меняет их день. Остальные — каждые 15 часов назад от
 * `now`: для пресетов.
 */
export const makeDateFilteringData = (
  count = 60,
  now = Math.floor(Date.now() / MINUTE) * MINUTE,
): DateFilteringItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-id-${i}`,
    name: `${NAMES[i % NAMES.length]} ${i}`,
    birthDate:
      i % 13 === 12
        ? null
        : `${1970 + (i % 30)}-${pad(1 + (i % 12))}-${pad(1 + (i % 28))}`,
    createdAt:
      i < 20
        ? `2026-03-15T${pad((i * 3) % 24)}:30:00Z`
        : new Date(now - (i - 20) * 15 * 60 * MINUTE).toISOString(),
  }))

export const dateFilteringData = makeDateFilteringData()

interface DateCellOptions {
  columnFilteringTimeZone?: string
  columnFilteringDateLocale?: { code?: string }
}

/** Момент в поясе и локали фильтра — чтобы смена пояса была видна в ячейке. */
const formatCreatedAt = (value: string, options: DateCellOptions) =>
  new Intl.DateTimeFormat(options.columnFilteringDateLocale?.code ?? 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: options.columnFilteringTimeZone,
  }).format(new Date(value))

export const dateFilteringColumns: ColumnDef<any, any>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 160,
    filter: 'text',
  },
  {
    id: 'birthDate',
    accessorKey: 'birthDate',
    header: 'Birth date',
    size: 160,
    filter: 'date',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Created',
    size: 220,
    filter: 'datetime',
    cell: ({ getValue, table }) =>
      formatCreatedAt(getValue() as string, table.options as DateCellOptions),
  },
] as ColumnDef<any, any>[]
