/**
 * Место первого изменения строк для виртуализатора (ADR 0145). Модель, которая знает его,
 * пишет в журнал «список `next` получен из `previous`, первое отличие — `from`»;
 * виртуализатор строк сравнивает свою прошлую сборку с текущей и сверку ключей не делает.
 * Отрезки прежних строк после него виртуализатор переносит сдвигом (ADR 0210).
 */
import { type DataOperation, dataModeOf } from './dataMode'
import { rowSourceOf } from './rowSource'

/** Id строк по виду смены модели (ADR 0194): по ним журнал совмещает прежний и новый списки. */
export interface RowChangeSets {
  inserted: ReadonlySet<string>
  changed: ReadonlySet<string>
  removed: ReadonlySet<string>
}

interface RowChange {
  previous: object
  from: number
  sets?: RowChangeSets
  /** Длина цепочки до этой смены: дальше MAX_STEPS прежние списки отпускаются. */
  depth: number
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
  sets?: RowChangeSets,
) => {
  if (next === previous) return
  const depth = (changes.get(previous)?.depth ?? 0) + 1
  changes.set(next, { previous, from, depth, sets })
  // Цепочку длиннее, чем её ищут, не держим: прежние списки — это прежние строки (ADR 0200, EN26).
  if (depth > MAX_STEPS) {
    let list: object = next
    for (let step = 0; step < MAX_STEPS; step++) {
      list = changes.get(list)!.previous
    }
    changes.delete(list)
  }
}

/** Подсказку списка больше не спросят: прежний список отпускается (ADR 0200, EN26). */
export const forgetRowChange = (list: object) => {
  changes.delete(list)
}

interface ChangePath {
  from: number
  /** Наборы id каждой смены пути; `undefined` — у одной из смен их нет. */
  sets: RowChangeSets[] | undefined
}

/**
 * Путь журнала от `previous` к `current`; `undefined` — цепочки нет. `consume` — путь прочитан
 * последний раз (сборка виртуализатора): прежние списки отпускаются.
 */
const changeSince = (
  current: object,
  previous: object,
  consume: boolean,
): ChangePath | undefined => {
  let list = current
  let from = Infinity
  let sets: RowChangeSets[] | undefined = []
  for (let step = 0; step <= MAX_STEPS; step++) {
    if (list === previous) {
      if (consume) {
        for (let at = current; at !== previous;) {
          const change = changes.get(at)!
          changes.delete(at)
          at = change.previous
        }
      }
      return { from, sets }
    }
    const change = changes.get(list)
    if (!change) {
      return undefined
    }
    from = Math.min(from, change.from)
    if (change.sets) sets?.push(change.sets)
    else sets = undefined
    list = change.previous
  }
  return undefined
}

/** Первое отличие `current` от `previous` по журналу; `undefined` — цепочки нет. */
export const firstChangeSince = (
  current: object,
  previous: object,
  consume = false,
): number | undefined => changeSince(current, previous, consume)?.from

type ListRow = { id: string }

/**
 * Отрезки прежних строк в прежнем порядке после `from` (ADR 0210, §3): тройки «новое начало,
 * прежнее начало, длина». Отрезок — только из тех же объектов строк; наборы id направляют
 * совмещение, а где их нет или порядок менялся — берётся общий конец списков.
 */
export const keptRuns = (
  next: readonly ListRow[],
  previous: readonly ListRow[],
  from: number,
  sets: readonly RowChangeSets[] | undefined,
): number[] => {
  const runs: number[] = []
  const has = (id: string, kind: 'inserted' | 'removed') =>
    sets!.some(set => set[kind].has(id) || set.changed.has(id))
  let i = from
  let j = from
  let runAt = -1
  let runFrom = 0
  const close = () => {
    if (runAt >= 0) runs.push(runAt, runFrom, i - runAt)
    runAt = -1
  }
  while (i < next.length && j < previous.length) {
    if (next[i] === previous[j]) {
      if (runAt < 0) {
        runAt = i
        runFrom = j
      }
      i++
      j++
      continue
    }
    close()
    if (!sets) break
    if (has(previous[j]!.id, 'removed')) j++
    else if (has(next[i]!.id, 'inserted')) i++
    else break
  }
  close()
  let a = next.length
  let b = previous.length
  while (a > i && b > j && next[a - 1] === previous[b - 1]) {
    a--
    b--
  }
  if (a < next.length) runs.push(a, b, next.length - a)
  return runs
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

/**
 * Подсказка виртуализатору: первый индекс, где `next` может отличаться от `previous`, и отрезки
 * прежних строк после него (ADR 0210).
 */
export const firstChangedIndex = (
  table: unknown,
  previous: RowBuild,
  next: RowBuild,
): number | { from: number; kept: number[] } | undefined => {
  if (!rowChangeHints.enabled) {
    return undefined
  }
  // Ключ — индекс: ключи прежних индексов не меняются.
  if (next.keyByIndex && previous.keyByIndex) {
    return next.count
  }
  if (next.list && previous.list) {
    // Сборка виртуализатора спрашивает путь один раз: после — его списки не нужны.
    const path = changeSince(next.list, previous.list, true)
    if (path) {
      const kept = keptRuns(
        next.list as readonly ListRow[],
        previous.list as readonly ListRow[],
        path.from,
        path.sets,
      )
      return kept.length ? { from: path.from, kept } : path.from
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
