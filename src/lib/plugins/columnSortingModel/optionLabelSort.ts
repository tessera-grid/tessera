/**
 * Сортировка колонки с вариантами по подписи (ADR 0063): варианты `options` — в их
 * порядке, затем значения с подписью вне `options` — по алфавиту подписи, затем без
 * подписи — по строке значения, пустые — последними. Массив — поэлементно.
 */
import { constructSortFn } from '@tanstack/react-table'

import {
  type ColumnOption,
  type ColumnOptionsDef,
  extraOptionLabel,
  hasColumnOptions,
  isEmptyOptionValue,
} from '../../core/columnOptions'

export interface SortColumn {
  id: string
  table: object
  columnDef: ColumnOptionsDef & { sortFn?: unknown; invertSorting?: boolean }
  getIsSorted: () => false | 'asc' | 'desc'
}

const collator = new Intl.Collator()
const RANK_LIMIT = 64

interface TextRank {
  text: string
  rank: number
}

/** Ключи держат ссылку на ранг: вставка сдвигает числа, сохраняя порядок ключей. */
const createTextRanks = () => {
  const byText = new Map<string, TextRank>()
  const ordered: TextRank[] = []
  return (text: string): TextRank | string => {
    const cached = byText.get(text)
    if (cached) return cached
    if (byText.size === RANK_LIMIT) return text

    const index = ordered.findIndex(
      key => collator.compare(key.text, text) >= 0,
    )
    const rank = index < 0 ? ordered.length : index
    const next = ordered[rank]
    if (next && collator.compare(next.text, text) === 0) {
      byText.set(text, next)
      return next
    }

    const key = { text, rank }
    ordered.splice(rank, 0, key)
    for (let i = rank + 1; i < ordered.length; i++) ordered[i]!.rank = i
    byText.set(text, key)
    return key
  }
}

const compareText = (a: TextRank | string, b: TextRank | string) =>
  typeof a === 'object' && typeof b === 'object'
    ? a.rank - b.rank
    : collator.compare(
        typeof a === 'string' ? a : a.text,
        typeof b === 'string' ? b : b.text,
      )

const indexMaps = new WeakMap<ColumnOption[], Map<unknown, number>>()

const indexMapOf = (options: ColumnOption[]) => {
  let map = indexMaps.get(options)
  if (!map) {
    map = new Map(options.map((option, index) => [option.value, index]))
    indexMaps.set(options, map)
  }
  return map
}

/** Группы ключа по возрастанию: вариант `options`, подпись вне `options`, без подписи. */
const OPTION = 0
const LABELLED = 1
const UNLABELLED = 2

type SortKey = readonly [group: number, place: number | string | TextRank]

const keyOf = (
  column: SortColumn,
  value: unknown,
  rank: ReturnType<typeof createTextRanks>,
): SortKey => {
  const index = column.columnDef.options
    ? indexMapOf(column.columnDef.options).get(value)
    : undefined
  if (index !== undefined) return [OPTION, index]
  const label = extraOptionLabel(column.table, column, value)
  return label === undefined
    ? [UNLABELLED, rank(String(value))]
    : [LABELLED, rank(label)]
}

const compareKeys = ([groupA, placeA]: SortKey, [groupB, placeB]: SortKey) => {
  if (groupA !== groupB) return groupA - groupB
  return typeof placeA === 'number'
    ? placeA - (placeB as number)
    : compareText(placeA, placeB as TextRank | string)
}

/** Ключ значения: пустое — отметка, массив — ключи элементов. */
type ValueKey = typeof EMPTY | SortKey | SortKey[]

const EMPTY = Symbol('empty')

/** Одиночный ключ — список из одного: смесь значения и массива сравнивается поэлементно. */
const asList = (key: SortKey | SortKey[]): SortKey[] =>
  Array.isArray(key[0]) ? (key as SortKey[]) : [key as SortKey]

const compareValueKeys = (a: SortKey | SortKey[], b: SortKey | SortKey[]) => {
  if (!Array.isArray(a[0]) && !Array.isArray(b[0])) {
    return compareKeys(a as SortKey, b as SortKey)
  }
  const itemsA = asList(a)
  const itemsB = asList(b)
  const length = Math.min(itemsA.length, itemsB.length)
  for (let i = 0; i < length; i++) {
    const order = compareKeys(itemsA[i], itemsB[i])
    if (order !== 0) return order
  }
  return itemsA.length - itemsB.length
}

/**
 * Функция сортировки колонки по контракту `constructSortFn`: ключ считается один раз
 * на значение (`resolveDataValue`), пустые — после непустых в обе стороны.
 */
export const optionLabelSortFn = (column: SortColumn) => {
  const rank = createTextRanks()
  return constructSortFn({
    resolveDataValue: (value: unknown): ValueKey => {
      if (isEmptyOptionValue(value)) return EMPTY
      return Array.isArray(value)
        ? value.map(item => keyOf(column, item, rank))
        : keyOf(column, value, rank)
    },
    sort: (a: unknown, b: unknown) => {
      const emptyA = a === EMPTY
      const emptyB = b === EMPTY
      if (emptyA || emptyB) {
        // Модель обращает результат по убыванию и при invertSorting — заранее
        // обращаем, чтобы пустые остались внизу.
        const flipped =
          (column.getIsSorted() === 'desc') !== !!column.columnDef.invertSorting
        const order = Number(emptyA) - Number(emptyB)
        return flipped ? -order : order
      }
      return compareValueKeys(
        a as SortKey | SortKey[],
        b as SortKey | SortKey[],
      )
    },
  } as never)
}

/** Колонке с вариантами без своей функции сортировки ставит сортировку по подписи. */
export const optionLabelSortFeature = {
  initColumnInstanceData: (column: SortColumn) => {
    const { columnDef } = column
    if (columnDef.sortFn === 'auto' && hasColumnOptions(columnDef)) {
      columnDef.sortFn = optionLabelSortFn(column)
    }
  },
}
