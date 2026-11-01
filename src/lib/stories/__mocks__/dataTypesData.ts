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

/** Товары с пропусками и номерами в названиях: порядок по типу и пустые в конце (S1). */
export const SORT_ROWS = (
  [
    ['Lamp 10', 120, '2026-03-14'],
    ['chair 2', 9.5, '2025-11-02'],
    [null, 45, '2026-01-20'],
    ['Lamp 2', null, '2026-07-01'],
    ['mug', 1000, null],
    ['Chair 12', 89.9, '2024-12-31'],
    ['lamp 1', 200, '2026-02-03'],
    ['Desk', 15, '2025-06-18'],
    [null, 7, '2026-10-05'],
    ['desk mat', null, '2026-05-09'],
  ] as const
).map(([name, price, released], index) => ({
  ...productAt(index),
  name,
  price,
  released,
}))

/** Названия на латинице и кириллице, цены с разрядами: вид и порядок по языку (S7). */
export const LOCALE_ROWS = (
  [
    ['Lamp', 1234.5],
    ['Кружка', 18.9],
    ['Apple', 2499],
    ['Лампа', 1150.75],
    ['Notebook', 3200],
    ['Яблоко', 4.2],
    ['Mug', 12.5],
    ['Блокнот', 1890.1],
  ] as const
).map(([name, price], index) => ({ ...productAt(index), name, price }))

/** Менеджеры — записи с номером и именем (ADR 0174, S1). */
export const MANAGERS = [
  { id: 'm1', name: 'Ann Lee' },
  { id: 'm2', name: 'Boris Petrov' },
  { id: 'm3', name: 'Chen Wei' },
  { id: 'm4', name: 'Dana Cruz' },
]

/** Товары с менеджером; у каждой строки — своя копия записи, равенство — по номеру. */
export const managedRows = (count: number) =>
  productRows(count).map((row, index) => ({
    ...row,
    manager: { ...MANAGERS[(index * 3) % MANAGERS.length]! },
  }))

/** Колонка менеджера: тип `object`, подпись по умолчанию — поле `name`. */
export const MANAGER_COLUMN: ColumnDef<any, any> = {
  id: 'manager',
  accessorKey: 'manager',
  header: 'Manager',
  dataType: 'object',
}

/** Владельцы — записи без полей по умолчанию: номер `uid`, имя из двух частей (S2). */
export const ownedRows = (count: number) =>
  productRows(count).map((row, index) => ({
    ...row,
    owner: {
      uid: `E-${101 + (index % 6)}`,
      first: ['Ann', 'Boris', 'Chen', 'Dana', 'Eva', 'Femi'][index % 6]!,
      last: ['Lee', 'Petrov', 'Wei', 'Cruz', 'Novak', 'Ade'][index % 6]!,
    },
  }))

/** Тип «человек»: номер — `uid`, подпись — имя и фамилия (S2). */
export const PERSON_TYPES: DataTypeRegistry = {
  person: {
    extends: 'object',
    getKey: (value: { uid: string }) => value.uid,
    getLabel: (value: { first: string; last: string }) =>
      `${value.first} ${value.last}`,
  },
}

/** Суммы строками: у двух первых различается только последняя цифра (ADR 0174, S3, S4). */
export const AMOUNT_ROWS = (
  [
    '98765432109876543.20',
    '98765432109876543.21',
    '1500.00',
    '-250.75',
    '0.10',
    '999.99',
    '0',
    '12.5',
    '-0.01',
    '100000.00',
  ] as const
).map((amount, index) => ({ ...productAt(index), amount }))

/** Остаток строкой с двумя знаками: колонка `numberString` в Playground (ADR 0174). */
export const BALANCE_COLUMN: ColumnDef<any, any> = {
  id: 'balance',
  header: 'Balance',
  dataType: 'numberString',
  accessorFn: (row: Product) => row.price.toFixed(2),
}
