/**
 * Отфильтрованная модель строк для `columnFiltering` и `quickSearch` (ADR 0045).
 * Стоковый кэш смотрит только на срезы фильтров, а быстрый поиск сверяет показанный текст
 * видимых колонок: при активном поиске смена видимости, `locale`, `dataTypes` и `timeZone`
 * пересобирает кэш (ADR 0201, QT12). Смена пояса дат (ADR 0047) при активных фильтрах колонок —
 * тоже. Без фильтров и поиска
 * второй проход подряд строки не обходит (ADR 0068). Срез операции, которую выполняет
 * сервер, клиент не применяет (ADR 0169, §1). Смена `data` при тех же фильтрах проверяет
 * только изменённые и вставленные строки (ADR 0194). Поиск проверяет строку проверкой,
 * подготовленной функцией поиска раз на проход (ADR 0201).
 */
import { constructRow, makeObjectMap } from '@tanstack/react-table'

import {
  type RowModelChange,
  recordRowModelChange,
  rowModelChangeOf,
} from '../../core/dataChanges'
import { dataModeOf } from '../../core/dataMode'
import { stageOfSlot, type StageRun } from '../../core/rowEngine/engine'
import { RowDict, dictModel, editDictOf } from '../../core/rowEngine/rowDict'
import type { RowData, Table, TableFeatures } from '../../types'
import { skipIdlePasses } from './idleRowModel'
import { copyPosition, positionOf, setPosition } from '../../core/rowPosition'

interface Atom {
  get: () => unknown
}

type AddMeta = (meta: unknown) => void
type FilterFn = ((
  row: FilterRow,
  columnId: string,
  value: unknown,
  addMeta: AddMeta,
) => boolean) & {
  resolveFilterValue?: (value: unknown) => unknown
  /** Проверка встроенного фильтра колонки, подготовленная раз на проход. */
  prepareColumnCheck?: (
    table: FilteringTable,
    columnId: string,
    value: unknown,
  ) => (row: FilterRow) => boolean
  /** Проверка строки поиском, подготовленная раз на проход; `undefined` — по колонкам (ADR 0201, §2). */
  prepareRowCheck?: (
    table: FilteringTable,
    columns: readonly FilterColumn[],
    value: unknown,
  ) => ((row: FilterRow) => boolean) | undefined
}

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
    locale?: string
    dataTypes?: unknown
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
  reusedTree?: boolean
}

/** Фильтры колонок и поиска — как у стоковой модели TanStack. */
const resolveFilters = (table: FilteringTable) => {
  const columnFilters = table.atoms.columnFilters?.get() ?? []
  const globalFilter = table.atoms.globalFilter?.get()
  const columns: {
    id: string
    filterFn: FilterFn
    value: unknown
    check?: (row: FilterRow) => boolean
  }[] = []
  for (const filter of columnFilters) {
    const filterFn = table.getColumn(filter.id)?.getFilterFn()
    if (!filterFn) continue
    const value = filterFn.resolveFilterValue?.(filter.value) ?? filter.value
    columns.push({
      id: filter.id,
      filterFn,
      value,
      check: filterFn.prepareColumnCheck?.(table, filter.id, value),
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
  let search: ((row: FilterRow) => boolean) | undefined
  if (globalFn && searchable.length) {
    ids.push('__global__')
    const value = globalFn.resolveFilterValue?.(globalFilter) ?? globalFilter
    search = globalFn.prepareRowCheck?.(table, searchable, value)
    if (!search) {
      for (const column of searchable) {
        global.push({ id: column.id, filterFn: globalFn, value })
      }
    }
  }
  return { columns, global, ids, search }
}

const frozenMap = <T>(entries: Record<string, T>) =>
  Object.freeze(Object.assign(makeObjectMap<T>(), entries))

/** Вердикты строки при одном поиске — общие на все строки (ADR 0201, §5). */
const FOUND = frozenMap({ __global__: true })
const NOT_FOUND = frozenMap({ __global__: false })
const NO_META = frozenMap<unknown>({})

/** Проверка строки фильтрами — как у стоковой модели. */
const checkRow = (
  row: FilterRow,
  { columns, global, search }: ReturnType<typeof resolveFilters>,
) => {
  if (search && !columns.length) {
    row.columnFilters = search(row) ? FOUND : NOT_FOUND
    row.columnFiltersMeta = NO_META
    return
  }
  row.columnFilters = makeObjectMap()
  row.columnFiltersMeta = makeObjectMap()
  const addMeta = (id: string) => (meta: unknown) => {
    row.columnFiltersMeta[id] = meta
  }
  for (const filter of columns) {
    row.columnFilters[filter.id] = filter.check
      ? filter.check(row)
      : filter.filterFn(row, filter.id, filter.value, addMeta(filter.id))
  }
  if (search) row.columnFilters.__global__ = search(row)
  else if (global.length) {
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
  copyPosition(row, next)
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
    if (positionOf(rows[mid]!) < index) lo = mid + 1
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
    const old = change.previous?.get(id) as FilterRow | undefined
    const now = input.rowsById[id]
    if (!old || !now || positionOf(old) !== positionOf(now)) return null
  }
  const appended: FilterRow[] = []
  for (const id of change.inserted) {
    const row = input.rowsById[id]
    if (!row || positionOf(row) < before) return null
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
    const at = placeOf(rows, positionOf(row))
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
  for (const row of appended.sort((a, b) => positionOf(a) - positionOf(b))) {
    checkRow(row, filters)
    if (!passes(row)) continue
    const next = out(row)
    placed.push(next)
    rows.push(next)
    inserted.add(row.id)
  }
  const { dict, writer } = editDictOf(prev.output)
  for (const id of removed) writer.delete(id)
  for (const row of placed) writer.set(row.id, row)
  const output = dictModel(
    dict,
    writer.version,
    rows,
    rows.slice(),
  ) as FilterModel
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
  if (rows.length === input.rows.length) {
    return {
      rows,
      flatRows: rows,
      get rowsById() {
        return input.rowsById
      },
    }
  }
  const rowsById = makeObjectMap<FilterRow>()
  for (const row of rows) rowsById[row.id] = row
  const dict = new RowDict(rowsById)
  return dictModel(dict, dict.version(), rows, rows) as FilterModel
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
    // Те же дети — строка входа без копии (ADR 0200, EN28): копия нужна, когда дети другие.
    if (flat || sameList(row.subRows, subRows)) return row
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
      // Прежняя копия встаёт на нынешнее место строки (ADR 0200, §5).
      if (positionOf(old) !== positionOf(row)) setPosition(old, positionOf(row))
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
    (prev.output === prev.input && !prev.reusedTree) ||
    columnFilters !== prev.columnFilters ||
    globalFilter !== prev.globalFilter
  ) {
    return undefined
  }
  const filters = resolveFilters(table)
  const flat = patchFlatFiltered(table, prev, input, change, filters)
  if (flat) return { input, columnFilters, globalFilter, output: flat }
  // Новые объекты строк — только изменённые и вставленные: прочие проверены прежним проходом.
  for (const ids of [change.changed, change.inserted]) {
    for (const id of ids) {
      const row = input.rowsById[id]
      if (row) checkRow(row, filters)
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
  // Прежние объекты — из своего прежнего выхода: его словарь стадия не меняла.
  const previous = new Map<string, object>()
  for (const ids of [changed, removed]) {
    for (const id of ids) if (was[id]) previous.set(id, was[id])
  }
  recordRowModelChange(output, {
    prev: prev.output,
    changed,
    inserted,
    removed,
    previous,
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

/**
 * Полный отбор — как у стоковой модели TanStack: без фильтров и поиска словари фильтров строк
 * сбрасываются, вход — как есть; иначе проверка всех строк и отбор, у дерева — копии родителей с
 * детьми отбора (`constructRow`, поля — при создании; ADR 0200, §4).
 */
const fullFilter = (table: FilteringTable, input: FilterModel): FilterModel => {
  const columnFilters = table.atoms.columnFilters?.get()
  const globalFilter = table.atoms.globalFilter?.get()
  const searching =
    globalFilter !== undefined && globalFilter !== null && globalFilter !== ''
  if (!input.rows.length || (!columnFilters?.length && !searching)) {
    for (const row of input.flatRows) {
      row.columnFilters = makeObjectMap()
      row.columnFiltersMeta = makeObjectMap()
    }
    return input
  }
  if (isFlat(input)) return filterFlat(table, input)
  const filters = resolveFilters(table)
  const singleId = filters.ids.length === 1 ? filters.ids[0] : undefined
  let allPass = singleId !== undefined
  for (const row of input.flatRows) {
    checkRow(row, filters)
    if (allPass && row.columnFilters[singleId!] === false) allPass = false
  }
  return allPass ? input : filterTree(table, input.rows, filters.ids)
}

/** Таблицы, строки которых видели активный отбор: их словари фильтров не пустые (ADR 0068, §1а). */
const filteredOnce = new WeakSet<object>()

const searchAwareStages = new WeakSet<object>()

export const isSearchAwareFilterStage = (slot: unknown): boolean => {
  const stage = stageOfSlot(slot)
  return !!stage && searchAwareStages.has(stage.create)
}

/** Стадия фильтра и поиска: вход — у движка (ADR 0200, §3). */
export const createSearchAwareFilteredRowModel = <
  TFeatures extends TableFeatures,
  TData extends RowData = any,
>() => {
  const create = (table: Table<TFeatures, TData>): StageRun => {
    const client = clientViewOf(table)
    const t = client as unknown as FilteringTable
    const { atoms } = t
    let visibility: unknown = UNSET
    let timeZone: unknown = UNSET
    let locale: unknown = UNSET
    let dataTypes: unknown = UNSET
    let last: Filtered | undefined
    let read: () => unknown = () => undefined
    const filtered = () => {
      const input = read() as FilterModel
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
      // Как мемо стоковой модели: сброс страницы — со второго отбора, после пересчёта.
      if (last) queueMicrotask(() => t.autoResetPageIndex?.())
      if (patched) {
        last = patched
        return patched.output
      }
      const output = fullFilter(t, input)
      last = {
        input,
        columnFilters,
        globalFilter,
        output,
        reusedTree:
          output === input &&
          !isFlat(input) &&
          (!!columnFilters?.length ||
            (globalFilter != null && globalFilter !== '')),
      }
      return output
    }
    const searchValue = () => atoms.globalFilter?.get()
    const filtering = () => (atoms.columnFilters?.get()?.length ?? 0) > 0
    const searchAware = () => {
      const next = atoms.columnVisibility?.get()
      const { timeZone: nextTimeZone, locale: nextLocale } = t.options
      const nextDataTypes = t.options.dataTypes
      const searching = !!searchValue()
      const changed = (prev: unknown, value: unknown) =>
        prev !== UNSET && value !== prev
      // Поиск сверяет показанный текст ячейки: он зависит от видимых колонок, языка, реестра
      // типов и пояса (ADR 0201, QT12); фильтры дат колонок — от пояса.
      const stale =
        (searching &&
          (changed(visibility, next) ||
            changed(locale, nextLocale) ||
            changed(dataTypes, nextDataTypes) ||
            changed(timeZone, nextTimeZone))) ||
        (changed(timeZone, nextTimeZone) && filtering())
      visibility = next
      timeZone = nextTimeZone
      locale = nextLocale
      dataTypes = nextDataTypes
      // Смена — отбор заново, без сброса страницы.
      if (stale) last = undefined
      if (filtering() || !!searchValue()) filteredOnce.add(table)
      return filtered()
    }
    const run = skipIdlePasses(
      searchAware,
      () => read() as FilterModel,
      () => {
        const search = searchValue()
        return (
          !filtering() &&
          (search === undefined || search === null || search === '')
        )
      },
      () => t.autoResetPageIndex?.(),
      () => !filteredOnce.has(table),
    )
    return next => {
      read = next
      return run()
    }
  }
  searchAwareStages.add(create)
  return create
}

/**
 * Модель после отбора — вход группировки (`getPreGroupedRowModel`): по её строкам считают итоги
 * колонок по всем узлам дерева (ADR 0229).
 */
export const preGroupedModelOf = <TRow>(
  table: unknown,
): { rows: readonly TRow[] } =>
  (
    table as { getPreGroupedRowModel: () => { rows: readonly TRow[] } }
  ).getPreGroupedRowModel()
