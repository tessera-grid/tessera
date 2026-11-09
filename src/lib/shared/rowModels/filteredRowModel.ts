/**
 * Отфильтрованная модель строк для `columnFiltering` и `quickSearch` (ADR 0045).
 * Стоковый кэш смотрит только на срезы фильтров, а быстрый поиск идёт по видимым
 * колонкам: при активном поиске смена видимости пересобирает кэш. Смена пояса дат
 * (`timeZone`, ADR 0047) при активных фильтрах колонок — тоже. Без фильтров и поиска
 * второй проход подряд строки не обходит (ADR 0068). Срез операции, которую выполняет
 * сервер, клиент не применяет (ADR 0169, §1). Смена `data` при тех же фильтрах проверяет
 * только изменённые и вставленные строки (ADR 0194).
 */
import {
  constructRow,
  createFilteredRowModel,
  makeObjectMap,
} from '@tanstack/react-table'

import {
  type RowModelChange,
  recordRowModelChange,
  rowModelChangeOf,
} from '../../core/dataChanges'
import { dataModeOf } from '../../core/dataMode'
import { handOverRowsById } from '../../core/rowsByIdHandover'
import type { RowData, Table, TableFeatures } from '../../types'
import { skipIdlePasses } from './idleRowModel'

interface Atom {
  get: () => unknown
}

type AddMeta = (meta: unknown) => void
type FilterFn = ((
  row: FilterRow,
  columnId: string,
  value: unknown,
  addMeta: AddMeta,
) => boolean) & { resolveFilterValue?: (value: unknown) => unknown }

interface FilterColumn {
  id: string
  getFilterFn: () => FilterFn | undefined
  getCanGlobalFilter: () => boolean
}

interface FilteringTable {
  atoms: {
    columnVisibility?: Atom
    globalFilter?: Atom
    columnFilters?: { get: () => { id: string; value: unknown }[] | undefined }
  }
  options: {
    timeZone?: string
    filterFromLeafRows?: boolean
    maxLeafRowFilterDepth?: number
  }
  getPreFilteredRowModel: () => unknown
  getColumn: (id: string) => FilterColumn | undefined
  getAllLeafColumns: () => FilterColumn[]
  getGlobalFilterFn: () => FilterFn | undefined
  autoResetPageIndex?: () => void
}

interface FilterRow {
  id: string
  index: number
  depth: number
  original: unknown
  parentId?: string
  subRows: FilterRow[]
  columnFilters: Record<string, boolean>
  columnFiltersMeta: Record<string, unknown>
}

interface FilterModel {
  rows: FilterRow[]
  flatRows: FilterRow[]
  rowsById: Record<string, FilterRow>
}

interface Filtered {
  input: FilterModel
  columnFilters: unknown
  globalFilter: unknown
  output: FilterModel
}

/** Фильтры колонок и поиска — как у стоковой модели TanStack. */
const resolveFilters = (table: FilteringTable) => {
  const columnFilters = table.atoms.columnFilters?.get() ?? []
  const globalFilter = table.atoms.globalFilter?.get()
  const columns: { id: string; filterFn: FilterFn; value: unknown }[] = []
  for (const filter of columnFilters) {
    const filterFn = table.getColumn(filter.id)?.getFilterFn()
    if (!filterFn) continue
    columns.push({
      id: filter.id,
      filterFn,
      value: filterFn.resolveFilterValue?.(filter.value) ?? filter.value,
    })
  }
  const ids = columnFilters.map(filter => filter.id)
  const global: typeof columns = []
  const searching =
    globalFilter !== undefined && globalFilter !== null && globalFilter !== ''
  // Без фичи поиска её методов у таблицы нет, а срез поиска пуст.
  const globalFn = searching ? table.getGlobalFilterFn() : undefined
  const searchable = globalFn
    ? table.getAllLeafColumns().filter(column => column.getCanGlobalFilter())
    : []
  if (globalFn && searchable.length) {
    ids.push('__global__')
    for (const column of searchable) {
      global.push({
        id: column.id,
        filterFn: globalFn,
        value: globalFn.resolveFilterValue?.(globalFilter) ?? globalFilter,
      })
    }
  }
  return { columns, global, ids }
}

/** Проверка строки фильтрами — как у стоковой модели. */
const checkRow = (
  row: FilterRow,
  { columns, global }: ReturnType<typeof resolveFilters>,
) => {
  row.columnFilters = makeObjectMap()
  row.columnFiltersMeta = makeObjectMap()
  const addMeta = (id: string) => (meta: unknown) => {
    row.columnFiltersMeta[id] = meta
  }
  for (const filter of columns) {
    row.columnFilters[filter.id] = filter.filterFn(
      row,
      filter.id,
      filter.value,
      addMeta(filter.id),
    )
  }
  if (global.length) {
    row.columnFilters.__global__ = false
    for (const filter of global) {
      if (filter.filterFn(row, filter.id, filter.value, addMeta(filter.id))) {
        row.columnFilters.__global__ = true
        break
      }
    }
  }
}

const pushSubtree = (
  rows: readonly FilterRow[],
  flat: FilterRow[],
  byId: Record<string, FilterRow>,
) => {
  for (const row of rows) {
    flat.push(row)
    byId[row.id] = row
    if (row.subRows.length) pushSubtree(row.subRows, flat, byId)
  }
}

/** Копия строки в отборе `filterFromLeafRows` — как у `filterRows` TanStack. */
const copyRow = (
  table: FilteringTable,
  row: FilterRow,
  subRows: FilterRow[],
) => {
  const next = constructRow(
    table as never,
    row.id,
    row.original as never,
    row.index,
    row.depth,
    undefined,
    row.parentId,
  ) as unknown as FilterRow
  next.columnFilters = row.columnFilters
  next.columnFiltersMeta = row.columnFiltersMeta
  next.subRows = subRows
  return next
}

/** Первое место в отборе, чей индекс строки не меньше `index`: отбор хранит порядок строк. */
const placeOf = (rows: readonly FilterRow[], index: number) => {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (rows[mid]!.index < index) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Плоские строки без сдвигов — замена на месте и дописывание в конец (ADR 0194): отбор —
 * копией прежнего, изменённые встают на место поиском по индексу, словарь переходит новой
 * модели. `null` — случай не этот.
 */
const patchFlatFiltered = (
  table: FilteringTable,
  prev: Filtered,
  input: FilterModel,
  change: RowModelChange,
  filters: ReturnType<typeof resolveFilters>,
): FilterModel | null => {
  const before = prev.input.rows.length
  if (
    change.removed.size > 0 ||
    input.flatRows.length !== input.rows.length ||
    prev.input.flatRows.length !== before ||
    prev.output.flatRows.length !== prev.output.rows.length ||
    input.rows.length !== before + change.inserted.size
  ) {
    return null
  }
  // Изменённая строка на другом месте — перенос (ADR 0199, §2): общий путь.
  for (const id of change.changed) {
    const old = (change.previous?.get(id) ?? prev.input.rowsById[id]) as
      FilterRow | undefined
    if (!old || old.index !== input.rowsById[id]?.index) return null
  }
  const appended: FilterRow[] = []
  for (const id of change.inserted) {
    const row = input.rowsById[id]
    if (!row || row.index < before) return null
    appended.push(row)
  }
  const passes = (row: FilterRow) => {
    for (const id of filters.ids)
      if (row.columnFilters[id] === false) return false
    return true
  }
  // Плоская строка — сама строка входа (ADR 0200, EN28).
  const out = (row: FilterRow) => row
  const rows = prev.output.rows.slice()
  const changed = new Set<string>()
  const inserted = new Set<string>()
  const removed = new Set<string>()
  const placed: FilterRow[] = []
  const previous = new Map<string, object>()
  for (const id of change.changed) {
    const row = input.rowsById[id]
    if (!row) return null
    checkRow(row, filters)
    const at = placeOf(rows, row.index)
    const was = rows[at]?.id === id
    if (passes(row)) {
      const next = out(row)
      placed.push(next)
      if (was) {
        previous.set(id, rows[at]!)
        rows[at] = next
        changed.add(id)
      } else {
        rows.splice(at, 0, next)
        inserted.add(id)
      }
    } else if (was) {
      previous.set(id, rows[at]!)
      rows.splice(at, 1)
      removed.add(id)
    }
  }
  for (const row of appended.sort((a, b) => a.index - b.index)) {
    checkRow(row, filters)
    if (!passes(row)) continue
    const next = out(row)
    placed.push(next)
    rows.push(next)
    inserted.add(row.id)
  }
  const rowsById = handOverRowsById(prev.output)
  for (const id of removed) delete rowsById[id]
  for (const row of placed) rowsById[row.id] = row
  const output = { rows, flatRows: rows.slice(), rowsById }
  recordRowModelChange(output, {
    prev: prev.output,
    changed,
    inserted,
    removed,
    inPlace: true,
    previous,
  })
  return output
}

/**
 * Полный отбор плоских строк (ADR 0200, EN28): проверка — как у стоковой модели, строки
 * отбора — сами строки входа, без копий.
 */
const filterFlat = (table: FilteringTable, input: FilterModel): FilterModel => {
  const filters = resolveFilters(table)
  const rows: FilterRow[] = []
  for (const row of input.rows) {
    checkRow(row, filters)
    let passes = true
    for (const id of filters.ids) {
      if (row.columnFilters[id] === false) {
        passes = false
        break
      }
    }
    if (passes) rows.push(row)
  }
  const rowsById =
    rows.length === input.rows.length
      ? input.rowsById
      : makeObjectMap<FilterRow>()
  if (rowsById !== input.rowsById)
    for (const row of rows) rowsById[row.id] = row
  return { rows, flatRows: rows, rowsById }
}

const isFlat = (model: FilterModel) =>
  model.flatRows.length === model.rows.length

const sameList = (a: readonly FilterRow[], b: readonly FilterRow[]) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Отбор по уже проверенным строкам — как `filterRows` TanStack. Копия строки из прошлой
 * модели `previous` переходит, если строка входа, её проверка и видимые дети те же.
 */
const filterTree = (
  table: FilteringTable,
  rows: readonly FilterRow[],
  ids: readonly string[],
  previous?: Record<string, FilterRow>,
): FilterModel => {
  const passes = (row: FilterRow) => {
    for (const id of ids) if (row.columnFilters[id] === false) return false
    return true
  }
  const maxDepth = table.options.maxLeafRowFilterDepth ?? 100
  const flatRows: FilterRow[] = []
  const rowsById = makeObjectMap<FilterRow>()
  // Плоская модель — строки входа без копий (ADR 0200, EN28).
  const flat = rows.length === 0 || rows.every(row => !row.subRows.length)
  const copyOf = (row: FilterRow, subRows: FilterRow[]) => {
    if (flat) return row
    const old = previous?.[row.id]
    if (
      old &&
      old !== row &&
      old.original === row.original &&
      old.index === row.index &&
      old.depth === row.depth &&
      old.parentId === row.parentId &&
      old.columnFilters === row.columnFilters &&
      sameList(old.subRows, subRows)
    ) {
      return old
    }
    return copyRow(table, row, subRows)
  }
  if (table.options.filterFromLeafRows) {
    const fromLeafs = (list: readonly FilterRow[], depth: number) => {
      const kept: FilterRow[] = []
      for (const row of list) {
        if (row.subRows.length && depth < maxDepth) {
          const subRows = fromLeafs(row.subRows, depth + 1)
          if (subRows.length || passes(row)) kept.push(copyOf(row, subRows))
        } else if (passes(row)) {
          kept.push(copyOf(row, row.subRows))
        }
      }
      return kept
    }
    const kept = fromLeafs(rows, 0)
    pushSubtree(kept, flatRows, rowsById)
    return { rows: kept, flatRows, rowsById }
  }
  const fromRoot = (list: readonly FilterRow[], depth: number) => {
    const kept: FilterRow[] = []
    for (const row of list) {
      if (!passes(row)) continue
      if (row.subRows.length && depth < maxDepth) {
        const at = flatRows.length
        flatRows.push(row)
        const next = copyOf(row, fromRoot(row.subRows, depth + 1))
        flatRows[at] = next
        rowsById[next.id] = next
        kept.push(next)
      } else {
        kept.push(row)
        flatRows.push(row)
        rowsById[row.id] = row
        if (row.subRows.length) pushSubtree(row.subRows, flatRows, rowsById)
      }
    }
    return kept
  }
  return { rows: fromRoot(rows, 0), flatRows, rowsById }
}

const addSubtree = (row: FilterRow, into: Set<string>) => {
  into.add(row.id)
  for (const child of row.subRows) addSubtree(child, into)
}

/**
 * Смена `data` при тех же фильтрах (ADR 0194): проверяются только изменённые и вставленные
 * строки, сдвинутые берут проверку прежней строки; отбор — по проверенным строкам.
 */
const patchFiltered = (
  table: FilteringTable,
  prev: Filtered,
  input: FilterModel,
): Filtered | undefined => {
  const change = rowModelChangeOf(input) as RowModelChange | undefined
  const columnFilters = table.atoms.columnFilters?.get()
  const globalFilter = table.atoms.globalFilter?.get()
  if (
    !change ||
    change.prev !== prev.input ||
    prev.output === prev.input ||
    columnFilters !== prev.columnFilters ||
    globalFilter !== prev.globalFilter
  ) {
    return undefined
  }
  const filters = resolveFilters(table)
  const flat = patchFlatFiltered(table, prev, input, change, filters)
  if (flat) return { input, columnFilters, globalFilter, output: flat }
  const before = prev.input.rowsById
  for (const row of input.flatRows) {
    const old = before[row.id]
    if (row === old) continue
    if (old && !change.changed.has(row.id) && !change.inserted.has(row.id)) {
      row.columnFilters = old.columnFilters
      row.columnFiltersMeta = old.columnFiltersMeta
    } else {
      checkRow(row, filters)
    }
  }
  const output = filterTree(
    table,
    input.rows,
    filters.ids,
    prev.output.rowsById,
  )

  // Смена отбора: строка могла войти в него или уйти вместе с видимым поддеревом.
  const was = prev.output.rowsById
  const now = output.rowsById
  const changed = new Set<string>()
  const inserted = new Set<string>()
  const removed = new Set<string>()
  for (const id of change.changed) {
    if (was[id] && now[id]) changed.add(id)
    else if (was[id]) addSubtree(was[id], removed)
    else if (now[id]) addSubtree(now[id], inserted)
  }
  for (const id of change.inserted) if (now[id]) inserted.add(id)
  for (const id of change.removed) if (was[id]) removed.add(id)
  recordRowModelChange(output, {
    prev: prev.output,
    changed,
    inserted,
    removed,
  })
  return { input, columnFilters, globalFilter, output }
}

const UNSET = Symbol('unset')
const NO_SLICE: Atom = { get: () => undefined }

/**
 * Таблица, у которой срезы серверных операций пусты. Строки стоковая модель строит по
 * прототипу самой таблицы — ссылка на таблицу у строк прежняя.
 */
const clientViewOf = <T extends object>(table: T): T => {
  const t = table as unknown as FilteringTable
  const atoms = new Proxy(t.atoms, {
    get: (target, key, receiver) => {
      if (
        key === 'columnFilters' &&
        dataModeOf(table, 'filtering') === 'server'
      )
        return NO_SLICE
      if (key === 'globalFilter' && dataModeOf(table, 'search') === 'server')
        return NO_SLICE
      return Reflect.get(target, key, receiver) as unknown
    },
  })
  return new Proxy(table, {
    get: (target, key, receiver) =>
      key === 'atoms' ? atoms : (Reflect.get(target, key, receiver) as unknown),
  })
}

export const createSearchAwareFilteredRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const client = clientViewOf(table)
    const t = client as unknown as FilteringTable
    const { atoms } = t
    let visibility: unknown = UNSET
    let timeZone: unknown = UNSET
    let rowModel = createFilteredRowModel<TFeatures, TData>()(client)
    let last: Filtered | undefined
    const filtered = () => {
      const input = t.getPreFilteredRowModel() as FilterModel
      const columnFilters = atoms.columnFilters?.get()
      const globalFilter = atoms.globalFilter?.get()
      if (
        last &&
        last.input === input &&
        last.columnFilters === columnFilters &&
        last.globalFilter === globalFilter
      ) {
        return last.output
      }
      const patched = last && patchFiltered(t, last, input)
      if (patched) {
        last = patched
        t.autoResetPageIndex?.()
        return patched.output
      }
      let output: FilterModel
      if (isFlat(input) && input.rows.length) {
        output = filterFlat(t, input)
        // Как `skipFirstRun` стоковой модели: сброс страницы — со второго отбора.
        if (last) t.autoResetPageIndex?.()
      } else {
        output = rowModel() as unknown as FilterModel
      }
      last = { input, columnFilters, globalFilter, output }
      return output
    }
    const searchValue = () => atoms.globalFilter?.get()
    const filtering = () => (atoms.columnFilters?.get()?.length ?? 0) > 0
    const searchAware = () => {
      const next = atoms.columnVisibility?.get()
      const nextTimeZone = t.options.timeZone
      const searching = !!searchValue()
      const stale =
        (visibility !== UNSET && next !== visibility && searching) ||
        (timeZone !== UNSET && nextTimeZone !== timeZone && filtering())
      visibility = next
      timeZone = nextTimeZone
      if (stale) {
        rowModel = createFilteredRowModel<TFeatures, TData>()(client)
        last = undefined
      }
      return filtered() as unknown as ReturnType<typeof rowModel>
    }
    return skipIdlePasses(
      searchAware,
      () => t.getPreFilteredRowModel() as ReturnType<typeof rowModel>,
      () => {
        const search = searchValue()
        return (
          !filtering() &&
          (search === undefined || search === null || search === '')
        )
      },
      () => t.autoResetPageIndex?.(),
    )
  }
