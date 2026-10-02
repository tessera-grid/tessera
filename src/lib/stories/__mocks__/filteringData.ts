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
