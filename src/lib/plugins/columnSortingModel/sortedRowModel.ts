/**
 * Стадия сортировки движка строк (ADR 0064, ADR 0200, §3–§4): значения сортируемых колонок
 * читаются один раз на строку, а функции по контракту `constructSortFn` сравнивают уже
 * приведённые значения. Строки выхода — объекты входа: дети, чей порядок изменился, — дети
 * показа выхода, без копий родителей. Смена `data` и приход ответа ленивых детей при той же
 * сортировке собираются из прошлой модели по записи смены (ADR 0072, ADR 0194, ADR 0200, EN32):
 * изменённые и вставленные строки встают на свои места поиском, удалённые уходят.
 */
import {
  type RowModelChange,
  recordRowModelChange,
  rowModelChangeOf,
} from '../../core/dataChanges'
import { childrenOf, setChildren } from '../../core/rowEngine/displayChildren'
import type { StageRun } from '../../core/rowEngine/engine'
import { positionOf } from '../../core/rowPosition'

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

/** Дети показа модели: свои записи стадии или дети входа. */
type ShownChildren = (row: SortRow) => readonly SortRow[]

/**
 * Сортировка уровней дерева: детей строки даёт `kidsOf`, а уровень с другим порядком
 * записывается в `own` — дети показа выхода.
 */
const sorter = (
  entries: SortEntry[],
  kidsOf: ShownChildren,
  own: Map<string, SortRow[]>,
) => {
  const width = entries.length
  const resolvers = entries.map(entry =>
    entry.sortFn.sort ? entry.sortFn.resolveDataValue : undefined,
  )

  /** Порядок строк уровня: значения читаются один раз, сортируются индексы. */
  const sortRows = (rows: readonly SortRow[]): SortRow[] => {
    const raw = new Array<unknown>(rows.length * width)
    const keys = new Array<unknown>(rows.length * width)
    const order = new Array<number>(rows.length)
    for (let i = 0; i < rows.length; i++) {
      order[i] = i
      for (let e = 0; e < width; e++) {
        const value = rows[i]!.getValue(entries[e]!.id)
        const resolve = resolvers[e]
        raw[i * width + e] = value
        keys[i * width + e] = resolve ? resolve(value) : value
      }
    }
    order.sort((x, y) => {
      const rowX = rows[x]!
      const rowY = rows[y]!
      for (let e = 0; e < width; e++) {
        const a = x * width + e
        const b = y * width + e
        const result = compareEntry(
          entries[e]!,
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
      // Равные — в порядке уровня: он в порядке данных.
      return x - y
    })
    return order.map(i => rows[i]!)
  }

  /** Строка и её отсортированное поддерево в `flat`; порядок детей — в `own`. */
  const sortTree = (row: SortRow, flat: SortRow[]): SortRow => {
    flat.push(row)
    const kids = kidsOf(row)
    if (!kids.length) return row
    const children = sortLevel(kids, flat)
    if (children.changed) own.set(row.id, children.rows)
    else own.delete(row.id)
    return row
  }

  const sortLevel = (rows: readonly SortRow[], flat: SortRow[]) => {
    const result = sortRows(rows)
    let changed = false
    for (let i = 0; i < result.length; i++) {
      if (result[i] !== rows[i]) changed = true
      sortTree(result[i]!, flat)
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
  /** Дети показа выхода — уровни, чей порядок отличается от входа. */
  own: Map<string, SortRow[]>
  /** Позиция корня в `output.rows` по id — порядок корней при инкременте не меняется. */
  /** Начало участка каждого корня в `output.flatRows`; последний элемент — длина. */
  starts?: Int32Array
}

/** Срез сортировки по значению: атом с тем же составом может отдать новую ссылку. */
const sortingKey = (table: SortTable) =>
  (table.atoms.sorting?.get() ?? [])
    .map(sort => `${sort.id}\u0000${sort.desc ? 1 : 0}`)
    .join('\u0001')

const rulesOf = (table: SortTable) => [
  table.options.locale,
  table.options.dataTypes,
]

/** Выход стадии: строки входа, словарь входа, дети показа — свои поверх входа. */
const outputOf = (
  input: RowModel,
  rows: SortRow[],
  flatRows: SortRow[],
  own: Map<string, SortRow[]>,
): RowModel => {
  const output = {
    rows,
    flatRows,
    get rowsById() {
      return input.rowsById
    },
  }
  setChildren(output, own, input)
  return output
}

const NO_KIDS: readonly SortRow[] = []

/** Вход без поддеревьев: в плоском списке нет строк сверх корней. */
const isFlat = (input: RowModel) => input.flatRows.length === input.rows.length

/** Дети строки во входе стадии; у плоского входа — без поиска по цепочке стадий. */
const inputKids = (input: RowModel): ShownChildren =>
  isFlat(input) ? () => NO_KIDS : row => childrenOf(input, row)

/** Строки поддеревьев по детям показа, в порядке показа. */
const pushShown = (
  rows: readonly SortRow[],
  flat: SortRow[],
  kidsOf: ShownChildren,
) => {
  for (const row of rows) {
    flat.push(row)
    const kids = kidsOf(row)
    if (kids.length) pushShown(kids, flat, kidsOf)
  }
}

const fullSort = (table: SortTable, input: RowModel): Sorted => {
  const base = {
    input,
    sorting: sortingKey(table),
    rules: rulesOf(table),
  }
  const entries = input.rows.length ? sortEntries(table) : []
  if (!entries.length) {
    return { ...base, sortFns: [], output: input, own: new Map() }
  }
  const own = new Map<string, SortRow[]>()
  const { sortLevel } = sorter(entries, inputKids(input), own)
  const flatRows: SortRow[] = []
  const rows = sortLevel(input.rows, flatRows).rows
  return {
    ...base,
    sortFns: entries.map(entry => entry.sortFn),
    output: outputOf(input, rows, flatRows, own),
    own,
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

/** Сравнение двух строк по всем колонкам сортировки, как у полной; значения — раз на строку. */
/** `byIndex: false` — без последнего правила: равные значения сравниваются как равные. */
/** `values` — значения строк, общие с другим сравнением тех же колонок. */
const rowComparator = (
  entries: SortEntry[],
  byIndex = true,
  values = new Map<SortRow, unknown[]>(),
) => {
  const width = entries.length
  const valuesOf = (row: SortRow) => {
    let found = values.get(row)
    if (!found) {
      found = new Array<unknown>(width * 2)
      for (let e = 0; e < width; e++) {
        const value = row.getValue(entries[e]!.id)
        const { sortFn } = entries[e]!
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
        entries[e]!,
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
    return byIndex ? positionOf(a) - positionOf(b) : 0
  }
}

/** Уровень без строк на местах `drop` — копией отрезков между ними. */
const without = <T>(level: readonly T[], drop: ReadonlySet<number>): T[] => {
  const at = [...drop].sort((a, b) => a - b)
  const kept = new Array<T>(level.length - at.length)
  let write = 0
  let read = 0
  for (const skip of at) {
    while (read < skip) kept[write++] = level[read++]!
    read = skip + 1
  }
  while (read < level.length) kept[write++] = level[read++]!
  return kept
}

/** Число уходящих и приходящих строк уровня, до которого уровень правится `splice`. */
const FEW_CHANGES = 64
/** Сколько строк с равными значениями перебирает поиск уходящей строки, прежде чем взять места. */
const EQUAL_SCAN = 256

/** Склейка участков: немного больших участков — `concat`, много мелких — одним проходом. */
const concatPieces = (pieces: SortRow[][], length: number): SortRow[] => {
  if (pieces.length <= 1000) return ([] as SortRow[]).concat(...pieces)
  const out = new Array<SortRow>(length)
  let k = 0
  for (const piece of pieces) for (const row of piece) out[k++] = row
  return out
}

const sameList = (a: readonly SortRow[], b: readonly SortRow[]) =>
  a.length === b.length && a.every((row, i) => row === b[i])

/**
 * Смена с прежним порядком выживших (ADR 0194, ADR 0199): у каждого уровня — прежний порядок, из
 * которого уходят прежние объекты изменённых и удалённых строк, а изменённые и вставленные встают
 * на места поиском; плоский список — из участков прежнего.
 */
const patchInPlace = (
  table: SortTable,
  prev: Sorted,
  input: RowModel,
): Sorted | undefined => {
  const change = rowModelChangeOf(input) as RowModelChange | undefined
  const sorting = sortingKey(table)
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
  const values = new Map<SortRow, unknown[]>()
  const compare = rowComparator(entries, true, values)
  const own = new Map(prev.own)
  for (const id of removed) own.delete(id)
  const kidsOf = inputKids(input)
  const { sortTree } = sorter(entries, kidsOf, own)
  /** Дети показа прошлой модели. */
  const prevKids = (row: SortRow) => childrenOf(prev.output, row)
  /** Дети показа новой модели. */
  const shownKids: ShownChildren = row => own.get(row.id) ?? kidsOf(row)

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
      add(goes, old.parentId, old)
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
  /**
   * Место прежнего объекта в уровне. У сдвинутых строк место новое, а у уходящей — прежнее
   * (ADR 0199, §3): среди равных значений правило по месту может не совпасть, поэтому
   * объект ищется среди равных по тождеству.
   */
  let sameValues: ((a: SortRow, b: SortRow) => number) | undefined
  const findOld = (rows: readonly SortRow[], old: SortRow) => {
    sameValues ??= rowComparator(entries, false, values)
    // Малый блок равных значений — перебором без мест строк: места сдвинутых строк читать
    // не нужно, их запись отложена (ADR 0211).
    let lo = 0
    let hi = rows.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (sameValues(rows[mid]!, old) < 0) lo = mid + 1
      else hi = mid
    }
    const stop = Math.min(rows.length, lo + EQUAL_SCAN)
    for (let i = lo; i < stop && sameValues(rows[i]!, old) === 0; i++) {
      if (rows[i] === old) return i
    }
    const at = placeOf(rows, old)
    if (rows[at] === old) return at
    for (let i = at; i < rows.length && sameValues(rows[i]!, old) === 0; i++) {
      if (rows[i] === old) return i
    }
    for (let i = at - 1; i >= 0 && sameValues(rows[i]!, old) === 0; i--) {
      if (rows[i] === old) return i
    }
    return -1
  }
  const rebuilt = new Set<SortRow>()
  let failed = false
  const patchLevel = (
    prevLevel: readonly SortRow[],
    parentId: string | undefined,
  ): SortRow[] => {
    // Уходящие и приходящие — одним проходом по уровню, а не `splice` на каждую строку.
    const drop = new Set<number>()
    for (const old of goes.get(parentId) ?? []) {
      const at = findOld(prevLevel, old)
      if (at < 0 || drop.has(at)) {
        failed = true
        return []
      }
      drop.add(at)
    }
    // Немного строк — копия уровня и `splice`: сдвиг массива дешевле прохода по уровню.
    const few = drop.size + (comes.get(parentId)?.length ?? 0) <= FEW_CHANGES
    let kept: SortRow[]
    if (!drop.size) kept = prevLevel.slice()
    else if (few) {
      kept = prevLevel.slice()
      for (const at of [...drop].sort((a, b) => b - a)) kept.splice(at, 1)
    } else kept = without(prevLevel, drop)
    const coming = (comes.get(parentId) ?? []).slice().sort(compare)
    if (!coming.length) return kept
    /** Дети строки, что встаёт на место заново. */
    const patchKids = (row: SortRow) => {
      const kids = kidsOf(row)
      if (!kids.length) {
        own.delete(row.id)
        return
      }
      if (inserted.has(row.id)) {
        sortTree(row, [])
        return
      }
      const children = patchLevel(
        prevKids(previous.get(row.id) as SortRow),
        row.id,
      )
      if (failed) return
      if (sameList(children, kids)) own.delete(row.id)
      else own.set(row.id, children)
    }
    if (few) {
      let from = 0
      for (const row of coming) {
        patchKids(row)
        if (failed) return kept
        let lo = from
        let hi = kept.length
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (compare(kept[mid]!, row) < 0) lo = mid + 1
          else hi = mid
        }
        kept.splice(lo, 0, row)
        rebuilt.add(row)
        from = lo + 1
      }
      return kept
    }
    const rows: SortRow[] = []
    let from = 0
    for (const row of coming) {
      patchKids(row)
      if (failed) return rows
      let lo = from
      let hi = kept.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (compare(kept[mid]!, row) < 0) lo = mid + 1
        else hi = mid
      }
      for (let k = from; k < lo; k++) rows.push(kept[k]!)
      rows.push(row)
      rebuilt.add(row)
      from = lo
    }
    for (let k = from; k < kept.length; k++) rows.push(kept[k]!)
    return rows
  }
  const rows = patchLevel(prev.output.rows, undefined)
  if (failed) return undefined

  // Плоский список: участки прежних корней — из прежнего, перестроенных — обходом.
  const prevRows = prev.output.rows
  const prevFlat = prev.output.flatRows
  let flatRows: SortRow[]
  let starts: Int32Array | undefined
  if (prevFlat.length === prevRows.length && isFlat(input)) {
    flatRows = rows.slice()
  } else {
    const prevStarts = (prev.starts ??= rootStarts(prevRows, prevFlat))
    // Прежние корни идут в прежнем порядке: место участка — вторым указателем, подряд идущие
    // участки копируются одним срезом.
    const pieces: SortRow[][] = []
    starts = new Int32Array(rows.length + 1)
    let length = 0
    let j = 0
    let runFrom = -1
    let runTo = -1
    const flush = () => {
      if (runFrom < 0) return
      pieces.push(prevFlat.slice(runFrom, runTo))
      runFrom = -1
    }
    for (let i = 0; i < rows.length; i++) {
      starts[i] = length
      const row = rows[i]!
      // Тот же объект на очереди — прежний корень; перестроенные — объекты входа, их в прошлом нет.
      const same = prevRows[j] === row
      const isRebuilt = !same && rebuilt.has(row)
      if (!same && !isRebuilt) {
        while (j < prevRows.length && prevRows[j] !== row) j++
      }
      if (isRebuilt || j >= prevRows.length) {
        flush()
        const piece: SortRow[] = []
        pushShown([row], piece, shownKids)
        pieces.push(piece)
        length += piece.length
        continue
      }
      const from = prevStarts[j]!
      const to = prevStarts[j + 1]!
      if (runFrom >= 0 && runTo === from) runTo = to
      else {
        flush()
        runFrom = from
        runTo = to
      }
      length += to - from
      j++
    }
    flush()
    starts[rows.length] = length
    flatRows = pieces.length === 1 ? pieces[0]! : concatPieces(pieces, length)
  }

  const output = outputOf(input, rows, flatRows, own)
  recordRowModelChange(output, { ...change, prev: prev.output })
  return {
    input,
    sorting,
    rules: rulesOf(table),
    sortFns: entries.map(entry => entry.sortFn),
    output,
    own,
    starts,
  }
}

/**
 * Смена `data` при той же сортировке (ADR 0194): у каждого уровня — прежний порядок без
 * удалённых и изменённых строк, изменённые и вставленные встают на свои места поиском.
 * Сдвинутые строки — новые объекты входа с прежним порядком: сдвиг не меняет их сравнение;
 * их поддеревья переходят по id, а не по объектам.
 */
const patchData = (
  table: SortTable,
  prev: Sorted,
  input: RowModel,
): Sorted | undefined => {
  const change = rowModelChangeOf(input) as RowModelChange | undefined
  const sorting = sortingKey(table)
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
  const { changed, inserted, removed, previous } = change
  if (!previous) return undefined
  const current = input.rowsById
  const compare = rowComparator(entries)
  const own = new Map(prev.own)
  for (const id of removed) own.delete(id)
  const kidsOf = inputKids(input)
  const { sortTree } = sorter(entries, kidsOf, own)
  const prevKids = (row: SortRow) => childrenOf(prev.output, row)

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
    // Прежняя строка уровня — объект прошлой модели; на её месте — строка входа.
    const keptRow = (old: SortRow) => current[old.id] ?? old
    let from = 0
    for (const row of coming) {
      let lo = from
      let hi = kept.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (compare(keptRow(kept[mid]!), row) < 0) lo = mid + 1
        else hi = mid
      }
      for (let i = from; i < lo; i++) rows.push(kept[i]!)
      rows.push(row)
      from = lo
    }
    for (let i = from; i < kept.length; i++) rows.push(kept[i]!)
    if (rows.length !== inputLevel.length) {
      failed = true
      return { rows, changed: false }
    }

    let levelChanged = false
    for (let i = 0; i < rows.length && !failed; i++) {
      let row = rows[i]!
      if (inserted.has(row.id)) {
        sortTree(row, flat)
      } else {
        const isChanged = changed.has(row.id)
        // Прежняя строка — объект прошлой модели, нынешняя — объект входа.
        const old = isChanged ? (previous.get(row.id) as SortRow) : row
        const now = isChanged ? row : keptRow(row)
        if (!isChanged) {
          // Поддерево прежнее: предок изменённой строки сам изменён — данные неизменяемы,
          // предки ответа ленивых детей — копии (ADR 0200, §4).
          flat.push(now)
          const kids = prevKids(old!)
          if (kids.length) pushShown(kids, flat, prevKids)
        } else {
          row = now
          flat.push(row)
          const kids = kidsOf(now)
          if (kids.length) {
            const children = patchLevel(
              old ? prevKids(old) : [],
              kids,
              now.id,
              flat,
            )
            if (children.changed) own.set(now.id, children.rows)
            else own.delete(now.id)
          } else own.delete(now.id)
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

  const output = outputOf(input, rows, flatRows, own)
  recordRowModelChange(output, { ...change, prev: prev.output })
  return {
    input,
    sorting,
    rules: rulesOf(table),
    sortFns: entries.map(entry => entry.sortFn),
    output,
    own,
  }
}

/**
 * Стадия сортировки: вход — у движка (ADR 0200, §3); пересчёт после первого сбрасывает
 * страницу.
 */
export const createTesseraSortedRowModel =
  () =>
  (table: unknown): StageRun => {
    const t = table as SortTable
    let last: Sorted | undefined
    let deps: readonly unknown[] | undefined
    return read => {
      const input = read() as RowModel
      const next = [sortingKey(t), input, ...rulesOf(t)]
      if (last && deps && next.every((dep, i) => dep === deps![i])) {
        return last.output
      }
      const first = !last
      last =
        (last && (patchInPlace(t, last, input) ?? patchData(t, last, input))) ??
        fullSort(t, input)
      deps = next
      // Как мемо TanStack: сброс страницы — после пересчёта, не посреди чтения модели.
      if (!first) queueMicrotask(() => t.autoResetPageIndex?.())
      return last.output
    }
  }
