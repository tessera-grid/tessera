/**
 * Отсортированная модель строк (ADR 0064): устройство как у `createSortedRowModel`
 * TanStack, но значения сортируемых колонок читаются один раз на строку, а функции по
 * контракту `constructSortFn` сравнивают уже приведённые значения. `rowsById`
 * указывает на строки модели, в том числе на копии родителей с переставленными детьми.
 * Приход ответа при той же сортировке собирает модель из прошлой: порядок корней —
 * прежний, заново сортируются только изменённые поддеревья (ADR 0072). Смена `data` с
 * записанной сменой модели собирается из прошлой: изменённые и вставленные строки встают на
 * свои места поиском, удалённые уходят (ADR 0194).
 */
import {
  type createSortedRowModel,
  copyInstancePropertiesWithoutMemos,
  skipFirstRun,
  tableMemo,
} from '@tanstack/react-table'

import {
  type RowModelChange,
  recordRowModelChange,
  rowModelChangeOf,
} from '../../core/dataChanges'
import { handOverRowsById } from '../../core/rowsByIdHandover'

type SortedRowModelFactory = ReturnType<typeof createSortedRowModel>

interface SortRow {
  id: string
  index: number
  original: unknown
  parentId?: string
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
  /** Язык и типы колонок — правила сравнения сортировки по типу (ADR 0172, DT10). */
  options: { locale?: string; dataTypes?: unknown }
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
 * Сравнение двух строк по одной колонке: `raw` — значения ячеек, `key` — приведённые
 * `resolveDataValue`. `±Infinity` — ответ `sortUndefined: 'first' | 'last'`, не
 * зависящий от направления.
 */
const compareEntry = (
  entry: SortEntry,
  rawA: unknown,
  rawB: unknown,
  keyA: unknown,
  keyB: unknown,
  rowA: SortRow,
  rowB: SortRow,
): number => {
  let order = 0
  if (entry.sortUndefined) {
    const aUndefined = rawA === undefined
    const bUndefined = rawB === undefined
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
      ? sortFn.sort(keyA, keyB, rowA, rowB, entry.id)
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
        const a = x * width + e
        const b = y * width + e
        const result = compareEntry(
          entries[e],
          raw[a],
          raw[b],
          keys[a],
          keys[b],
          rowX,
          rowY,
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
    clonesOf.set(row, cloned)
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
  /** Правила сравнения, по которым построен порядок: язык и реестр типов. */
  rules: readonly unknown[]
  sortFns: RowSortFn[]
  output: RowModel
  /** `rowsById` модели — свой словарь (с копиями родителей), а не словарь входа. */
  ownIndex: boolean
  /** Позиция корня в `output.rows` по id — порядок корней при инкременте не меняется. */
  rootAt?: Map<string, number>
  /** Начало участка каждого корня в `output.flatRows`; последний элемент — длина. */
  starts?: Int32Array
}

const rulesOf = (table: SortTable) => [
  table.options.locale,
  table.options.dataTypes,
]

const fullSort = (table: SortTable): Sorted => {
  const input = table.getPreSortedRowModel()
  const base = {
    input,
    sorting: table.atoms.sorting?.get(),
    rules: rulesOf(table),
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
    rulesOf(table).some((rule, i) => rule !== prev.rules[i]) ||
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

/** Сравнение двух строк по всем колонкам сортировки, как у полной; значения — раз на строку. */
const rowComparator = (entries: SortEntry[]) => {
  const width = entries.length
  const values = new Map<SortRow, unknown[]>()
  const valuesOf = (row: SortRow) => {
    let found = values.get(row)
    if (!found) {
      found = new Array<unknown>(width * 2)
      for (let e = 0; e < width; e++) {
        const value = row.getValue(entries[e].id)
        const { sortFn } = entries[e]
        found[e] = value
        found[width + e] =
          sortFn.sort && sortFn.resolveDataValue
            ? sortFn.resolveDataValue(value)
            : value
      }
      values.set(row, found)
    }
    return found
  }
  return (a: SortRow, b: SortRow) => {
    const va = valuesOf(a)
    const vb = valuesOf(b)
    for (let e = 0; e < width; e++) {
      const result = compareEntry(
        entries[e],
        va[e],
        vb[e],
        va[width + e],
        vb[width + e],
        a,
        b,
      )
      if (result === -Infinity) return -1
      if (result === Infinity) return 1
      if (result !== 0) return result
    }
    return a.index - b.index
  }
}

const cloneWith = (row: SortRow, subRows: SortRow[]) => {
  const cloned = Object.create(Object.getPrototypeOf(row)) as SortRow
  copyInstancePropertiesWithoutMemos(cloned as never, row as never)
  cloned.subRows = subRows
  clonesOf.set(row, cloned)
  return cloned
}

/**
 * Смена без сдвигов (ADR 0194): у каждого уровня — прежний порядок, из которого уходят
 * прежние объекты изменённых и удалённых строк, а изменённые и вставленные встают на места
 * поиском; плоский список — из участков прежнего, словарь переходит новой модели.
 */
const patchInPlace = (table: SortTable, prev: Sorted): Sorted | undefined => {
  const input = table.getPreSortedRowModel()
  const change = rowModelChangeOf(input) as RowModelChange | undefined
  const sorting = table.atoms.sorting?.get()
  if (
    !change?.inPlace ||
    !change.previous ||
    change.prev !== prev.input ||
    prev.output === prev.input ||
    sorting !== prev.sorting ||
    rulesOf(table).some((rule, i) => rule !== prev.rules[i])
  ) {
    return undefined
  }
  const entries = sortEntries(table)
  if (
    entries.length !== prev.sortFns.length ||
    entries.some((entry, e) => entry.sortFn !== prev.sortFns[e])
  ) {
    return undefined
  }
  const { changed, inserted, removed, previous } = change
  const current = input.rowsById
  const compare = rowComparator(entries)
  const { sortTree } = sorter(entries, () => {})
  /** Объект строки в выходе прошлой модели: копия родителя или сама строка. */
  const sortedOld = (row: SortRow) => clonesOf.get(row) ?? row

  const comes = new Map<string | undefined, SortRow[]>()
  const goes = new Map<string | undefined, SortRow[]>()
  const add = (
    map: Map<string | undefined, SortRow[]>,
    key: string | undefined,
    row: SortRow,
  ) => {
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  for (const ids of [changed, removed]) {
    for (const id of ids) {
      const old = previous.get(id) as SortRow | undefined
      if (!old) return undefined
      add(goes, old.parentId, sortedOld(old))
    }
  }
  for (const ids of [changed, inserted]) {
    for (const id of ids) {
      const row = current[id]
      if (row) add(comes, row.parentId, row)
    }
  }

  /** Место строки в отсортированном уровне — поиском по её значениям. */
  const placeOf = (rows: readonly SortRow[], row: SortRow) => {
    let lo = 0
    let hi = rows.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (compare(rows[mid]!, row) < 0) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const rebuilt = new Set<SortRow>()
  let failed = false
  const patchLevel = (
    prevLevel: readonly SortRow[],
    parentId: string | undefined,
  ): SortRow[] => {
    const rows = prevLevel.slice()
    for (const old of goes.get(parentId) ?? []) {
      const at = placeOf(rows, old)
      if (rows[at] !== old) {
        failed = true
        return rows
      }
      rows.splice(at, 1)
    }
    for (const row of (comes.get(parentId) ?? []).slice().sort(compare)) {
      let placed = row
      if (row.subRows.length) {
        if (inserted.has(row.id)) {
          placed = sortTree(row, [])
        } else {
          const old = sortedOld(previous.get(row.id) as SortRow)
          const children = patchLevel(old.subRows, row.id)
          if (failed) return rows
          placed =
            children.length === row.subRows.length &&
            children.every((child, i) => child === row.subRows[i])
              ? row
              : cloneWith(row, children)
        }
      }
      rows.splice(placeOf(rows, row), 0, placed)
      rebuilt.add(placed)
    }
    return rows
  }
  const rows = patchLevel(prev.output.rows, undefined)
  if (failed) return undefined

  // Плоский список: участки прежних корней — из прежнего, перестроенных — обходом.
  const prevRows = prev.output.rows
  const prevFlat = prev.output.flatRows
  let flatRows: SortRow[]
  let starts: Int32Array | undefined
  if (
    prevFlat.length === prevRows.length &&
    rows.every(row => !row.subRows.length)
  ) {
    flatRows = rows.slice()
  } else {
    const prevStarts = (prev.starts ??= rootStarts(prevRows, prevFlat))
    const at = new Map<SortRow, number>()
    for (let i = 0; i < prevRows.length; i++) at.set(prevRows[i]!, i)
    flatRows = []
    starts = new Int32Array(rows.length + 1)
    for (let i = 0; i < rows.length; i++) {
      starts[i] = flatRows.length
      const row = rows[i]!
      const j = rebuilt.has(row) ? undefined : at.get(row)
      if (j === undefined) pushSubtree([row], flatRows)
      else {
        for (let k = prevStarts[j]!; k < prevStarts[j + 1]!; k++) {
          flatRows.push(prevFlat[k]!)
        }
      }
    }
    starts[rows.length] = flatRows.length
  }

  // Словарь: свой — переходит новой модели; без копий родителей — словарь входа.
  let rowsById = current
  let ownIndex = false
  if (prev.ownIndex) {
    rowsById = handOverRowsById(prev.output)
    for (const id of removed) delete rowsById[id]
    for (const row of rebuilt) {
      const subtree: SortRow[] = []
      pushSubtree([row], subtree)
      for (const item of subtree) rowsById[item.id] = item
    }
    ownIndex = true
  } else if ([...rebuilt].some(row => row !== current[row.id])) {
    rowsById = Object.assign(Object.create(null), current)
    for (const row of rebuilt) {
      const subtree: SortRow[] = []
      pushSubtree([row], subtree)
      for (const item of subtree) rowsById[item.id] = item
    }
    ownIndex = true
  }

  const output = { rows, flatRows, rowsById }
  const before = new Map<string, object>()
  for (const [id, old] of previous) before.set(id, sortedOld(old as SortRow))
  recordRowModelChange(output, {
    ...change,
    prev: prev.output,
    previous: before,
  })
  return {
    input,
    sorting,
    rules: rulesOf(table),
    sortFns: entries.map(entry => entry.sortFn),
    output,
    ownIndex,
    starts,
  }
}

const pushSubtree = (rows: readonly SortRow[], flat: SortRow[]) => {
  for (const row of rows) {
    flat.push(row)
    if (row.subRows.length) pushSubtree(row.subRows, flat)
  }
}

/**
 * Смена `data` при той же сортировке (ADR 0194): у каждого уровня — прежний порядок без
 * удалённых и изменённых строк, изменённые и вставленные встают на свои места поиском.
 * Сдвинутые строки — новые объекты входа с прежним порядком: сдвиг не меняет их сравнение;
 * их поддеревья переходят по id, а не по объектам.
 */
const patchData = (table: SortTable, prev: Sorted): Sorted | undefined => {
  const input = table.getPreSortedRowModel()
  const change = rowModelChangeOf(input) as RowModelChange | undefined
  const sorting = table.atoms.sorting?.get()
  if (
    !change ||
    change.prev !== prev.input ||
    prev.output === prev.input ||
    sorting !== prev.sorting ||
    rulesOf(table).some((rule, i) => rule !== prev.rules[i])
  ) {
    return undefined
  }
  const entries = sortEntries(table)
  if (
    entries.length !== prev.sortFns.length ||
    entries.some((entry, e) => entry.sortFn !== prev.sortFns[e])
  ) {
    return undefined
  }
  const { changed, inserted, removed } = change
  const prevInput = prev.input.rowsById
  const prevOutput = prev.output.rowsById
  const current = input.rowsById
  const compare = rowComparator(entries)
  const { sortTree } = sorter(entries, () => {})

  // Изменённые и вставленные строки по родителю — их место ищется заново.
  const moved = new Map<string | undefined, SortRow[]>()
  for (const ids of [changed, inserted]) {
    for (const id of ids) {
      const row = current[id]
      if (!row) continue
      const list = moved.get(row.parentId)
      if (list) list.push(row)
      else moved.set(row.parentId, [row])
    }
  }

  let failed = false
  const patchLevel = (
    prevLevel: readonly SortRow[],
    inputLevel: readonly SortRow[],
    parentId: string | undefined,
    flat: SortRow[],
  ): { rows: SortRow[]; changed: boolean } => {
    const kept: SortRow[] = []
    for (const old of prevLevel) {
      if (!removed.has(old.id) && !changed.has(old.id)) kept.push(old)
    }
    const coming = (moved.get(parentId) ?? []).slice().sort(compare)
    const rows: SortRow[] = []
    // Прежняя строка уровня — объект выхода прошлой модели; на её месте — строка входа.
    const keptRow = (old: SortRow) => current[old.id] ?? old
    let from = 0
    for (const row of coming) {
      let lo = from
      let hi = kept.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (compare(keptRow(kept[mid]), row) < 0) lo = mid + 1
        else hi = mid
      }
      for (let i = from; i < lo; i++) rows.push(kept[i])
      rows.push(row)
      from = lo
    }
    for (let i = from; i < kept.length; i++) rows.push(kept[i])
    if (rows.length !== inputLevel.length) {
      failed = true
      return { rows, changed: false }
    }

    let levelChanged = false
    for (let i = 0; i < rows.length && !failed; i++) {
      let row = rows[i]
      if (inserted.has(row.id)) {
        row = sortTree(row, flat)
      } else {
        const isChanged = changed.has(row.id)
        // Прежняя строка — объект выхода прошлой модели, нынешняя — объект входа.
        const old = isChanged ? prevOutput[row.id] : row
        const now = isChanged ? row : keptRow(row)
        if (!isChanged && now === prevInput[now.id]) {
          // Строка входа прежняя: выход прошлой модели переходит с поддеревом.
          flat.push(old!)
          if (old!.subRows.length) pushSubtree(old!.subRows, flat)
        } else {
          const at = flat.length
          row = now
          flat.push(row)
          if (now.subRows.length) {
            const children = patchLevel(
              old?.subRows ?? [],
              now.subRows,
              now.id,
              flat,
            )
            if (children.changed) {
              row = cloneWith(now, children.rows)
              flat[at] = row
            }
          }
        }
      }
      rows[i] = row
      if (row !== inputLevel[i]) levelChanged = true
    }
    return { rows, changed: levelChanged }
  }

  const flatRows: SortRow[] = []
  const { rows } = patchLevel(prev.output.rows, input.rows, undefined, flatRows)
  if (failed) return undefined

  let rowsById = current
  let ownIndex = false
  for (const row of flatRows) {
    if (row !== current[row.id]) {
      if (!ownIndex) {
        rowsById = Object.assign(Object.create(null), current)
        ownIndex = true
      }
      rowsById[row.id] = row
    }
  }
  const output = { rows, flatRows, rowsById }
  recordRowModelChange(output, { ...change, prev: prev.output })
  return {
    input,
    sorting,
    rules: rulesOf(table),
    sortFns: entries.map(entry => entry.sortFn),
    output,
    ownIndex,
  }
}

/** Сколько строк вставлять одним `splice`: аргументы вызова ограничены стеком. */
const SPLICE_LIMIT = 10_000

/** Копия родителя с переставленными детьми — по исходной строке. */
const clonesOf = new WeakMap<object, SortRow>()

export const createTesseraSortedRowModel = (): SortedRowModelFactory =>
  (table => {
    const t = table as unknown as SortTable
    let last: Sorted | undefined
    return tableMemo({
      feature: 'rowSortingFeature',
      table,
      fnName: 'table.getSortedRowModel',
      memoDeps: () => [
        t.atoms.sorting?.get(),
        t.getPreSortedRowModel(),
        ...rulesOf(t),
      ],
      fn: () => {
        last =
          (last &&
            (patchInPlace(t, last) ??
              patchData(t, last) ??
              patchSort(t, last))) ??
          fullSort(t)
        return last.output
      },
      onAfterUpdate: skipFirstRun(() => t.autoResetPageIndex?.()),
    } as never)
  }) as SortedRowModelFactory
