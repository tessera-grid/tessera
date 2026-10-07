/**
 * Отсортированная модель строк (ADR 0064): устройство как у `createSortedRowModel`
 * TanStack, но значения сортируемых колонок читаются один раз на строку, а функции по
 * контракту `constructSortFn` сравнивают уже приведённые значения. `rowsById`
 * указывает на строки модели, в том числе на копии родителей с переставленными детьми.
 */
import {
  type createSortedRowModel,
  copyInstancePropertiesWithoutMemos,
  skipFirstRun,
  tableMemo,
} from '@tanstack/react-table'

type SortedRowModelFactory = ReturnType<typeof createSortedRowModel>

interface SortRow {
  id: string
  index: number
  subRows: SortRow[]
  getValue: (columnId: string) => unknown
}

interface RowModel {
  rows: SortRow[]
  flatRows: SortRow[]
  rowsById: Record<string, SortRow>
}

type RowSortFn = ((a: SortRow, b: SortRow, columnId: string) => number) & {
  resolveDataValue?: (value: unknown) => unknown
  sort?: (
    a: unknown,
    b: unknown,
    rowA: SortRow,
    rowB: SortRow,
    columnId: string,
  ) => number
}

interface SortColumn {
  getCanSort: () => boolean
  getSortFn: () => RowSortFn
  columnDef: {
    sortUndefined?: false | -1 | 1 | 'first' | 'last'
    invertSorting?: boolean
  }
}

interface SortTable {
  atoms: { sorting?: { get: () => { id: string; desc: boolean }[] } }
  getPreSortedRowModel: () => RowModel
  getColumn: (id: string) => SortColumn | undefined
  autoResetPageIndex?: () => void
}

interface SortEntry {
  id: string
  desc: boolean
  sortUndefined: SortColumn['columnDef']['sortUndefined']
  invertSorting: boolean | undefined
  sortFn: RowSortFn
}

/**
 * Сравнение двух строк уровня по одной колонке. `raw` и `keys` — значения уровня,
 * прочитанные один раз: `[строка * число колонок + колонка]`. `±Infinity` — ответ
 * `sortUndefined: 'first' | 'last'`, не зависящий от направления.
 */
const compareEntry = (
  entry: SortEntry,
  a: number,
  b: number,
  rowA: SortRow,
  rowB: SortRow,
  raw: unknown[],
  keys: unknown[],
): number => {
  let order = 0
  if (entry.sortUndefined) {
    const aUndefined = raw[a] === undefined
    const bUndefined = raw[b] === undefined
    if (aUndefined && bUndefined) return 0
    if (aUndefined || bUndefined) {
      if (entry.sortUndefined === 'first')
        return aUndefined ? -Infinity : Infinity
      if (entry.sortUndefined === 'last')
        return aUndefined ? Infinity : -Infinity
      order = aUndefined ? entry.sortUndefined : -entry.sortUndefined
    }
  }
  if (order === 0) {
    const { sortFn } = entry
    order = sortFn.sort
      ? sortFn.sort(keys[a], keys[b], rowA, rowB, entry.id)
      : sortFn(rowA, rowB, entry.id)
  }
  if (order !== 0) {
    if (entry.desc) order *= -1
    if (entry.invertSorting) order *= -1
  }
  return order
}

const sortModel = (table: SortTable): RowModel => {
  const preSorted = table.getPreSortedRowModel()
  const sorting = table.atoms.sorting?.get()
  if (!preSorted.rows.length || !sorting?.length) return preSorted

  const entries: SortEntry[] = []
  for (const sort of sorting) {
    const column = table.getColumn(sort.id)
    if (!column?.getCanSort()) continue
    entries.push({
      id: sort.id,
      desc: sort.desc,
      sortUndefined: column.columnDef.sortUndefined,
      invertSorting: column.columnDef.invertSorting,
      sortFn: column.getSortFn(),
    })
  }
  if (!entries.length) return preSorted

  const width = entries.length
  const resolvers = entries.map(entry =>
    entry.sortFn.sort ? entry.sortFn.resolveDataValue : undefined,
  )

  /** Порядок строк уровня: значения читаются один раз, сортируются индексы. */
  const sortRows = (rows: SortRow[]): SortRow[] => {
    const raw = new Array<unknown>(rows.length * width)
    const keys = new Array<unknown>(rows.length * width)
    const order = new Array<number>(rows.length)
    for (let i = 0; i < rows.length; i++) {
      order[i] = i
      for (let e = 0; e < width; e++) {
        const value = rows[i].getValue(entries[e].id)
        const resolve = resolvers[e]
        raw[i * width + e] = value
        keys[i * width + e] = resolve ? resolve(value) : value
      }
    }
    order.sort((x, y) => {
      const rowX = rows[x]
      const rowY = rows[y]
      for (let e = 0; e < width; e++) {
        const result = compareEntry(
          entries[e],
          x * width + e,
          y * width + e,
          rowX,
          rowY,
          raw,
          keys,
        )
        if (result === -Infinity) return -1
        if (result === Infinity) return 1
        if (result !== 0) return result
      }
      return rowX.index - rowY.index
    })
    return order.map(i => rows[i])
  }

  const flatRows: SortRow[] = []
  let rowsById: Record<string, SortRow> | undefined

  const sortLevel = (rows: SortRow[]) => {
    const result = sortRows(rows)
    let changed = false
    for (let i = 0; i < result.length; i++) {
      const row = result[i]
      if (row !== rows[i]) changed = true
      const flatIndex = flatRows.length
      flatRows.push(row)
      if (!row.subRows.length) continue
      const children = sortLevel(row.subRows)
      if (!children.changed) continue
      // Как у TanStack: родитель с переставленными детьми — копия строки.
      const cloned = Object.create(Object.getPrototypeOf(row)) as SortRow
      copyInstancePropertiesWithoutMemos(cloned as never, row as never)
      cloned.subRows = children.rows
      result[i] = cloned
      flatRows[flatIndex] = cloned
      rowsById ??= Object.assign(Object.create(null), preSorted.rowsById)
      rowsById![row.id] = cloned
      changed = true
    }
    return { rows: result, changed }
  }

  return {
    rows: sortLevel(preSorted.rows).rows,
    flatRows,
    rowsById: rowsById ?? preSorted.rowsById,
  }
}

export const createTesseraSortedRowModel = (): SortedRowModelFactory =>
  (table => {
    const t = table as unknown as SortTable
    return tableMemo({
      feature: 'rowSortingFeature',
      table,
      fnName: 'table.getSortedRowModel',
      memoDeps: () => [t.atoms.sorting?.get(), t.getPreSortedRowModel()],
      fn: () => sortModel(t),
      onAfterUpdate: skipFirstRun(() => t.autoResetPageIndex?.()),
    } as never)
  }) as SortedRowModelFactory
