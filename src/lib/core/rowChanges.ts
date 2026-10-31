/**
 * Место первого изменения строк для виртуализатора (ADR 0145). Модель, которая знает его,
 * пишет в журнал «список `next` получен из `previous`, первое отличие — `from`»;
 * виртуализатор строк сравнивает свою прошлую сборку с текущей и сверку ключей не делает.
 */
import { type DataOperation, dataModeOf } from './dataMode'
import { rowSourceOf } from './rowSource'

interface RowChange {
  previous: object
  from: number
}

const changes = new WeakMap<object, RowChange>()
/** Сколько смен списка между двумя сборками виртуализатора ищется в журнале. */
const MAX_STEPS = 16

/** Подсказки включены; перф HV8 выключает их для базы. */
export const rowChangeHints = { enabled: true }

export const recordRowChange = (
  next: object,
  previous: object,
  from: number,
) => {
  if (next !== previous) {
    changes.set(next, { previous, from })
  }
}

/** Первое отличие `current` от `previous` по журналу; `undefined` — цепочки нет. */
export const firstChangeSince = (
  current: object,
  previous: object,
): number | undefined => {
  let list = current
  let from = Infinity
  for (let step = 0; step <= MAX_STEPS; step++) {
    if (list === previous) {
      return from
    }
    const change = changes.get(list)
    if (!change) {
      return undefined
    }
    from = Math.min(from, change.from)
    list = change.previous
  }
  return undefined
}

/** Список строк, по которому виртуализатор собрал позиции. */
export interface RowBuild {
  list?: object
  data: unknown
  count: number
  keyByIndex: boolean
}

interface BuildTable {
  options: {
    data: unknown
    appendOnlyData?: boolean
    manualGrouping?: boolean
  }
  store: {
    get: () => {
      sorting?: unknown[]
      columnFilters?: unknown[]
      globalFilter?: unknown
      grouping?: unknown[]
    }
  }
}

export const rowBuildOf = (table: unknown, list?: object): RowBuild => {
  const source = rowSourceOf(table)
  return {
    list: list ?? source.rows?.(),
    data: (table as BuildTable).options.data,
    count: source.count(),
    keyByIndex: !!source.keyByIndex,
  }
}

/** Модель на клиенте меняет порядок строк `data` или убирает часть из них. */
const reordersData = (table: BuildTable) => {
  const state = table.store.get()
  const client = (operation: DataOperation) =>
    dataModeOf(table, operation) === 'client'
  return (
    (!!state.sorting?.length && client('sorting')) ||
    (!!state.columnFilters?.length && client('filtering')) ||
    (!!state.globalFilter && client('search')) ||
    (!!state.grouping?.length && !table.options.manualGrouping)
  )
}

/** Подсказка виртуализатору: первый индекс, где `next` может отличаться от `previous`. */
export const firstChangedIndex = (
  table: unknown,
  previous: RowBuild,
  next: RowBuild,
): number | undefined => {
  if (!rowChangeHints.enabled) {
    return undefined
  }
  // Ключ — индекс: ключи прежних индексов не меняются.
  if (next.keyByIndex && previous.keyByIndex) {
    return next.count
  }
  if (next.list && previous.list) {
    const from = firstChangeSince(next.list, previous.list)
    if (from !== undefined) {
      return from
    }
  }
  const t = table as BuildTable
  if (
    t.options.appendOnlyData &&
    next.data !== previous.data &&
    Array.isArray(next.data) &&
    Array.isArray(previous.data) &&
    next.data.length > previous.data.length &&
    !reordersData(t)
  ) {
    return previous.count
  }
  return undefined
}
