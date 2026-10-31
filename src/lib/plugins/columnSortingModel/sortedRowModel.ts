/**
 * Отсортированная модель строк (ADR 0064): устройство как у `createSortedRowModel`
 * TanStack, но значения сортируемых колонок читаются один раз на строку, а функции по
 * контракту `constructSortFn` сравнивают уже приведённые значения. `rowsById`
 * указывает на строки модели, в том числе на копии родителей с переставленными детьми.
 * Приход ответа при той же сортировке собирает модель из прошлой: порядок корней —
 * прежний, заново сортируются только изменённые поддеревья (ADR 0072).
 */
import {
  type createSortedRowModel,
  copyInstancePropertiesWithoutMemos,
  skipFirstRun,
  tableMemo,
} from '@tanstack/react-table'

import { handOverRowsById } from '../../shared/rowModels/rowsByIdHandover'

type SortedRowModelFactory = ReturnType<typeof createSortedRowModel>

interface SortRow {
  id: string
  index: number
  original: unknown
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

const sortEntries = (table: SortTable) => {
  const entries: SortEntry[] = []
  for (const sort of table.atoms.sorting?.get() ?? []) {
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
  return entries
}

/** Сортировка уровней дерева; `onClone` получает копию родителя с переставленными детьми. */
const sorter = (
  entries: SortEntry[],
  onClone: (id: string, clone: SortRow) => void,
) => {
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

  /** Строка и её отсортированное поддерево в `flat`; копия строки, если порядок детей изменился. */
  const sortTree = (row: SortRow, flat: SortRow[]): SortRow => {
    const at = flat.length
    flat.push(row)
    if (!row.subRows.length) return row
    const children = sortLevel(row.subRows, flat)
    if (!children.changed) return row
    // Как у TanStack: родитель с переставленными детьми — копия строки.
    const cloned = Object.create(Object.getPrototypeOf(row)) as SortRow
    copyInstancePropertiesWithoutMemos(cloned as never, row as never)
    cloned.subRows = children.rows
    flat[at] = cloned
    onClone(row.id, cloned)
    return cloned
  }

  const sortLevel = (rows: SortRow[], flat: SortRow[]) => {
    const result = sortRows(rows)
    let changed = false
    for (let i = 0; i < result.length; i++) {
      if (result[i] !== rows[i]) changed = true
      const row = sortTree(result[i], flat)
      if (row !== result[i]) {
        result[i] = row
        changed = true
      }
    }
    return { rows: result, changed }
  }

  return { sortLevel, sortTree }
}

interface Sorted {
  input: RowModel
  sorting: unknown
  sortFns: RowSortFn[]
  output: RowModel
  /** `rowsById` модели — свой словарь (с копиями родителей), а не словарь входа. */
  ownIndex: boolean
  /** Позиция корня в `output.rows` по id — порядок корней при инкременте не меняется. */
  rootAt?: Map<string, number>
  /** Начало участка каждого корня в `output.flatRows`; последний элемент — длина. */
  starts?: Int32Array
}

const fullSort = (table: SortTable): Sorted => {
  const input = table.getPreSortedRowModel()
  const base = {
    input,
    sorting: table.atoms.sorting?.get(),
  }
  const entries = input.rows.length ? sortEntries(table) : []
  if (!entries.length) {
    return { ...base, sortFns: [], output: input, ownIndex: false }
  }
  let rowsById: Record<string, SortRow> | undefined
  const { sortLevel } = sorter(entries, (id, clone) => {
    rowsById ??= Object.assign(Object.create(null), input.rowsById)
    rowsById![id] = clone
  })
  const flatRows: SortRow[] = []
  const rows = sortLevel(input.rows, flatRows).rows
  return {
    ...base,
    sortFns: entries.map(entry => entry.sortFn),
    output: { rows, flatRows, rowsById: rowsById ?? input.rowsById },
    ownIndex: !!rowsById,
  }
}

/** Начала участков корней `rows` в `flatRows`. */
const rootStarts = (rows: SortRow[], flatRows: SortRow[]) => {
  const starts = new Int32Array(rows.length + 1)
  let root = 0
  for (let i = 0; i < flatRows.length && root < rows.length; i++) {
    if (flatRows[i] === rows[root]) {
      starts[root++] = i
    }
  }
  starts[rows.length] = flatRows.length
  return starts
}

/** Модель из прошлой: прежний порядок корней, заново — поддеревья изменённых (ADR 0072). */
const patchSort = (table: SortTable, prev: Sorted): Sorted | undefined => {
  const input = table.getPreSortedRowModel()
  const sorting = table.atoms.sorting?.get()
  if (
    prev.output === prev.input ||
    sorting !== prev.sorting ||
    input.rows.length !== prev.input.rows.length
  ) {
    return undefined
  }
  const entries = sortEntries(table)
  if (
    entries.length !== prev.sortFns.length ||
    entries.some(
      (entry, e) => !entry.sortFn.sort || entry.sortFn !== prev.sortFns[e],
    )
  ) {
    return undefined
  }

  // Изменённые корни: тот же `original` на той же позиции входа, другой объект.
  const changed: SortRow[] = []
  const limit = input.rows.length / 2
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const old = prev.input.rows[i]
    if (row === old) continue
    if (row.original !== old.original || row.id !== old.id) return undefined
    changed.push(row)
    if (changed.length > limit) return undefined
  }
  if (!changed.length) {
    return {
      ...prev,
      input,
      output: prev.ownIndex
        ? prev.output
        : { ...prev.output, rowsById: input.rowsById },
    }
  }

  const prevRows = prev.output.rows
  const rootAt = (prev.rootAt ??= new Map(
    prevRows.map((row, i) => [row.id, i]),
  ))
  const prevStarts = (prev.starts ??= rootStarts(
    prevRows,
    prev.output.flatRows,
  ))

  const clones: SortRow[] = []
  const { sortTree } = sorter(entries, (_id, clone) => clones.push(clone))
  const patches = changed
    .map(row => {
      const at = rootAt.get(row.id)!
      const piece: SortRow[] = []
      return { at, root: sortTree(row, piece), piece }
    })
    .sort((a, b) => b.at - a.at)

  const rows = prevRows.slice()
  const flatRows = prev.output.flatRows.slice()
  const starts = prevStarts.slice()
  for (const { at, root, piece } of patches) {
    rows[at] = root
    const from = prevStarts[at]
    const removed = prevStarts[at + 1] - from
    flatRows.splice(from, removed)
    for (let i = 0; i < piece.length; i += SPLICE_LIMIT) {
      flatRows.splice(from + i, 0, ...piece.slice(i, i + SPLICE_LIMIT))
    }
    const shift = piece.length - removed
    if (shift !== 0) {
      for (let i = at + 1; i <= rows.length; i++) starts[i] += shift
    }
  }

  let rowsById = input.rowsById
  let ownIndex = false
  if (prev.ownIndex) {
    // Свой словарь прошлой модели переходит новой: поддеревья изменённых — заново.
    rowsById = handOverRowsById(prev.output)
    for (const { at } of patches) {
      for (let i = prevStarts[at]; i < prevStarts[at + 1]; i++) {
        delete rowsById[prev.output.flatRows[i].id]
      }
    }
    for (const { piece } of patches) {
      for (const row of piece) rowsById[row.id] = row
    }
    ownIndex = true
  } else if (clones.length) {
    rowsById = Object.assign(Object.create(null), input.rowsById)
    for (const clone of clones) rowsById[clone.id] = clone
    ownIndex = true
  }

  return {
    ...prev,
    input,
    output: { rows, flatRows, rowsById },
    ownIndex,
    rootAt,
    starts,
  }
}

/** Сколько строк вставлять одним `splice`: аргументы вызова ограничены стеком. */
const SPLICE_LIMIT = 10_000

export const createTesseraSortedRowModel = (): SortedRowModelFactory =>
  (table => {
    const t = table as unknown as SortTable
    let last: Sorted | undefined
    return tableMemo({
      feature: 'rowSortingFeature',
      table,
      fnName: 'table.getSortedRowModel',
      memoDeps: () => [t.atoms.sorting?.get(), t.getPreSortedRowModel()],
      fn: () => {
        last = (last && patchSort(t, last)) ?? fullSort(t)
        return last.output
      },
      onAfterUpdate: skipFirstRun(() => t.autoResetPageIndex?.()),
    } as never)
  }) as SortedRowModelFactory
