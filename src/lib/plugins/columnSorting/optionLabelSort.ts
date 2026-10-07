/**
 * Сортировка колонки с вариантами по подписи (ADR 0063): варианты `options` — в их
 * порядке, затем значения с подписью вне `options` — по алфавиту подписи, затем без
 * подписи — по строке значения, пустые — последними. Массив — поэлементно.
 */
import {
  type ColumnOption,
  type ColumnOptionsDef,
  extraOptionLabel,
  hasColumnOptions,
  isEmptyOptionValue,
} from '../../core/columnOptions'

interface SortColumn {
  id: string
  table: object
  columnDef: ColumnOptionsDef & { sortFn?: unknown; invertSorting?: boolean }
  getIsSorted: () => false | 'asc' | 'desc'
}

interface SortRow {
  getValue: (columnId: string) => unknown
}

const collator = new Intl.Collator()

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

type SortKey = readonly [group: number, place: number | string]

const keyOf = (column: SortColumn, value: unknown): SortKey => {
  const index = column.columnDef.options
    ? indexMapOf(column.columnDef.options).get(value)
    : undefined
  if (index !== undefined) return [OPTION, index]
  const label = extraOptionLabel(column.table, column, value)
  return label === undefined ? [UNLABELLED, String(value)] : [LABELLED, label]
}

const compareKeys = ([groupA, placeA]: SortKey, [groupB, placeB]: SortKey) => {
  if (groupA !== groupB) return groupA - groupB
  return typeof placeA === 'number'
    ? placeA - (placeB as number)
    : collator.compare(placeA, placeB as string)
}

/** Функция сортировки колонки: пустые значения — после непустых в обе стороны. */
export const optionLabelSortFn = (column: SortColumn) => {
  // Ключи значений на один проход сортировки: он синхронный, подписи за это время не
  // меняются; кэш сбрасывается после прохода.
  let keys: Map<unknown, SortKey> | undefined
  const cachedKey = (value: unknown) => {
    if (!keys) {
      keys = new Map()
      queueMicrotask(() => {
        keys = undefined
      })
    }
    let key = keys.get(value)
    if (!key) {
      key = keyOf(column, value)
      keys.set(value, key)
    }
    return key
  }
  const compareItems = (a: unknown, b: unknown) => {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return compareKeys(cachedKey(a), cachedKey(b))
    }
    const length = Math.min(a.length, b.length)
    for (let i = 0; i < length; i++) {
      const order = compareKeys(cachedKey(a[i]), cachedKey(b[i]))
      if (order !== 0) return order
    }
    return a.length - b.length
  }
  return (rowA: SortRow, rowB: SortRow, columnId: string) => {
    const a = rowA.getValue(columnId)
    const b = rowB.getValue(columnId)
    const emptyA = isEmptyOptionValue(a)
    const emptyB = isEmptyOptionValue(b)
    if (emptyA || emptyB) {
      // TanStack обращает результат по убыванию и при invertSorting — заранее
      // обращаем, чтобы пустые остались внизу.
      const flipped =
        (column.getIsSorted() === 'desc') !== !!column.columnDef.invertSorting
      const order = Number(emptyA) - Number(emptyB)
      return flipped ? -order : order
    }
    return compareItems(a, b)
  }
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
