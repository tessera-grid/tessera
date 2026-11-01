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

/** Строка набора по номеру: тот же вид при любом объёме (серверные истории, ADR 0138). */
export const filteringItemAt = (i: number): FilteringItem => ({
  id: `item-id-${i}`,
  name: `${NAMES[i % NAMES.length]} ${i}`,
  city: CITIES[i % CITIES.length],
  age: i % 11 === 10 ? null : 18 + ((i * 7) % 50),
  vip: i % 9 === 8 ? null : i % 3 === 0,
  visits: i % 20,
})

export const makeFilteringData = (count = 60): FilteringItem[] =>
  Array.from({ length: count }, (_, i) => filteringItemAt(i))

export const filteringData = makeFilteringData()

export const filteringColumns: ColumnDef<any, any>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 160,
  },
  {
    id: 'city',
    accessorKey: 'city',
    header: 'City',
    size: 140,
  },
  {
    id: 'age',
    accessorKey: 'age',
    header: 'Age',
    size: 120,
    dataType: 'number',
  },
  {
    id: 'vip',
    accessorKey: 'vip',
    header: 'VIP',
    size: 120,
    dataType: 'boolean',
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
  timeZone?: string
  dateLocale?: { code?: string }
}

/** Момент в поясе и локали фильтра — чтобы смена пояса была видна в ячейке. */
const formatCreatedAt = (value: string, options: DateCellOptions) =>
  new Intl.DateTimeFormat(options.dateLocale?.code ?? 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: options.timeZone,
  }).format(new Date(value))

export const dateFilteringColumns: ColumnDef<any, any>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 160,
  },
  {
    id: 'birthDate',
    accessorKey: 'birthDate',
    header: 'Birth date',
    size: 160,
    dataType: 'dateString',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Created',
    size: 220,
    dataType: 'dateTimeString',
    cell: ({ getValue, table }) =>
      formatCreatedAt(getValue() as string, table.options as DateCellOptions),
  },
] as ColumnDef<any, any>[]

export interface OptionFilteringItem {
  id: string
  name: string
  status: string | null
  tags: string[]
  city: string
  managerId: string
}

export const STATUS_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

export const TAG_OPTIONS = [
  { value: 'vip', label: 'VIP' },
  { value: 'partner', label: 'Partner' },
  { value: 'new', label: 'New' },
  { value: 'churn-risk', label: 'Churn risk' },
]

const FIRST = [
  'Alice',
  'Bob',
  'Carol',
  'Dave',
  'Erin',
  'Frank',
  'Grace',
  'Heidi',
]
const LAST = [
  'Moss',
  'Reed',
  'Hale',
  'Stone',
  'Vance',
  'Wolfe',
  'Price',
  'Lane',
]

/** Справочник менеджеров (ADR 0048): 64 записи, id → имя. */
export const MANAGERS = Array.from({ length: 64 }, (_, i) => ({
  value: `m${i}`,
  label: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
}))

const managerNames = new Map(MANAGERS.map(m => [m.value, m.label]))

/**
 * Данные фильтра вариантов (ADR 0048): `status` — select (каждая 11-я строка пуста),
 * `tags` — multiselect, `city` — select без `options` (варианты из данных),
 * `managerId` — lookup (id справочника).
 */
export const makeOptionFilteringData = (count = 60): OptionFilteringItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-id-${i}`,
    name: `${NAMES[i % NAMES.length]} ${i}`,
    status:
      i % 11 === 10 ? null : STATUS_OPTIONS[i % STATUS_OPTIONS.length].value,
    tags: TAG_OPTIONS.filter((_, t) => (i * 7 + t * 5) % 3 === 0).map(
      t => t.value,
    ),
    city: CITIES[i % CITIES.length],
    managerId: MANAGERS[(i * 7) % MANAGERS.length].value,
  }))

export const optionFilteringData = makeOptionFilteringData()

/** «Сервер» справочника: поиск по имени с задержкой, отмена через `signal`. */
export const loadManagers = (
  search: string,
  { signal }: { signal: AbortSignal },
  delayMs = 300,
): Promise<{ value: string; label: string }[]> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const needle = search.trim().toLowerCase()
      resolve(
        MANAGERS.filter(m => m.label.toLowerCase().includes(needle)).slice(
          0,
          20,
        ),
      )
    }, delayMs)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(signal.reason)
    })
  })

export const optionFilteringColumns: ColumnDef<any, any>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 140,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    size: 130,
    options: STATUS_OPTIONS,
    dataType: 'select',
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: 'Tags',
    size: 220,
    options: TAG_OPTIONS,
    dataType: 'multiSelect',
  },
  {
    id: 'city',
    accessorKey: 'city',
    header: 'City',
    size: 120,
    dataType: 'select',
  },
  {
    id: 'managerId',
    accessorKey: 'managerId',
    header: 'Manager',
    size: 160,
    getOptionLabel: (id: string) => managerNames.get(id),
    dataType: 'select',
    loadOptions: loadManagers,
  },
] as ColumnDef<any, any>[]
