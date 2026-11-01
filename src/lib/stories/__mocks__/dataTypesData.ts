/**
 * Данные раздела «Columns/Data types» (ADR 0172): товары с колонками каждого встроенного
 * типа. Строки детерминированы — без генератора случайных значений.
 */
import type { DataTypeRegistry } from '../../core/dataTypes'
import type { ColumnDef } from '../../types'

export interface Product {
  id: string
  name: string
  price: number
  quantity: number
  inStock: boolean
  released: string
  updatedAt: string
  status: string
  tags: string[]
}

const NAMES = [
  'Desk lamp',
  'Office chair',
  'Notebook',
  'Water bottle',
  'Headphones',
  'Backpack',
  'Coffee mug',
  'Keyboard',
  'Monitor stand',
  'Desk mat',
]

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

export const TAG_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'sale', label: 'Sale' },
  { value: 'eco', label: 'Eco' },
]

const pad = (value: number) => String(value).padStart(2, '0')

const productAt = (index: number): Product => ({
  id: `product-${index + 1}`,
  name: `${NAMES[index % NAMES.length]} ${Math.floor(index / NAMES.length) + 1}`,
  price: Math.round((19.9 + ((index * 137.37) % 1180)) * 100) / 100,
  quantity: (index * 37) % 1250,
  inStock: index % 3 !== 0,
  released: `2026-${pad((index % 12) + 1)}-${pad((index % 27) + 1)}`,
  updatedAt: `2026-10-${pad((index % 30) + 1)}T${pad((index * 5) % 24)}:${pad((index * 7) % 60)}:00Z`,
  status: STATUS_OPTIONS[index % STATUS_OPTIONS.length]!.value,
  tags: TAG_OPTIONS.filter((_, tag) => (index + tag) % 2 === 0).map(
    option => option.value,
  ),
})

export const productRows = (count: number) =>
  Array.from({ length: count }, (_, index) => productAt(index))

/** Колонки товаров; `priceType` — тип колонки цены. */
export const productColumns = (
  priceType: string = 'number',
): ColumnDef<any, any>[] => [
  { id: 'name', accessorKey: 'name', header: 'Name', dataType: 'text' },
  { id: 'price', accessorKey: 'price', header: 'Price', dataType: priceType },
  {
    id: 'quantity',
    accessorKey: 'quantity',
    header: 'Quantity',
    dataType: 'number',
  },
  {
    id: 'inStock',
    accessorKey: 'inStock',
    header: 'In stock',
    dataType: 'boolean',
  },
  {
    id: 'released',
    accessorKey: 'released',
    header: 'Released',
    dataType: 'dateString',
  },
  {
    id: 'updatedAt',
    accessorKey: 'updatedAt',
    header: 'Updated',
    dataType: 'dateTimeString',
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    dataType: 'select',
    options: STATUS_OPTIONS,
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: 'Tags',
    dataType: 'multiSelect',
    options: TAG_OPTIONS,
  },
]

/** Свой тип «деньги»: число в долларах (S3). */
export const MONEY_TYPES: DataTypeRegistry = {
  money: {
    extends: 'number',
    format: { style: 'currency', currency: 'USD' },
  },
}

/** Вид всех дат таблицы в одном месте (S4). */
export const MEDIUM_DATES: DataTypeRegistry = {
  dateString: { format: { dateStyle: 'medium' } },
  dateTimeString: { format: { dateStyle: 'medium', timeStyle: 'short' } },
}
