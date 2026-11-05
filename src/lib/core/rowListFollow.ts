/**
 * Следование за списком строк серверной модели (ADR 0146, §6): новая выборка сбрасывает
 * то, что стоит на индексах строк, смена строк выше сдвигает, внутри — сбрасывает. Им
 * пользуются выделение по индексам и диапазоны подсветки и вспышки (ADR 0152, §4).
 */
import { type NewRowPlace, type RowListChange, rowSourceOf } from './rowSource'

/** Сдвиг промежутка `[top, bottom]` сменой списка: число строк или `null` — смена внутри. */
export const shiftIndexSpan = (
  top: number,
  bottom: number,
  { at, delta }: RowListChange,
): number | null => {
  // Вставка — перед строкой `at`, удаление — строки `[at, at - delta)`.
  const end = delta >= 0 ? at : at - delta
  if (at > bottom) return 0
  if (end > top) return null
  return delta
}

/**
 * Пачки смен по порядку: смены пачки — в индексах до неё, поэтому идут с конца списка и
 * места выше не сдвигают. `shift` возвращает новый промежуток или `null`.
 */
export const followSpans = <T>(
  items: readonly T[],
  batches: readonly (readonly RowListChange[])[],
  shift: (item: T, change: RowListChange) => T | null,
): T[] | null => {
  let current = items as T[]
  for (const batch of batches) {
    const changes = [...batch].sort((a, b) => b.at - a.at)
    const next: T[] = []
    for (const item of current) {
      let moved: T | null = item
      for (const change of changes) {
        moved = shift(moved, change)
        if (!moved) return null
      }
      next.push(moved)
    }
    current = next
  }
  return current
}

/**
 * Место строки после пачек смен; строка удалена — место строки за ней, она теперь там
 * (ADR 0157, §3). Конец списка таблица ограничивает сама.
 */
export const followIndex = (
  index: number,
  batches: readonly (readonly RowListChange[])[],
): number => {
  let current = index
  for (const batch of batches) {
    for (const { at, delta } of [...batch].sort((a, b) => b.at - a.at)) {
      if (delta >= 0) {
        if (at <= current) current += delta
      } else if (current >= at - delta) current += delta
      else if (current >= at) current = at
    }
  }
  return current
}

/**
 * Место строки до пачек смен — обратный ход `followIndex`; `undefined` — строку вставили
 * (движение строк ADR 0107 в серверной модели).
 */
export const priorIndex = (
  index: number,
  batches: readonly (readonly RowListChange[])[],
): number | undefined => {
  let current = index
  for (let batch = batches.length - 1; batch >= 0; batch--) {
    for (const { at, delta } of [...batches[batch]].sort(
      (a, b) => a.at - b.at,
    )) {
      if (current < at) continue
      if (delta > 0 && current < at + delta) return undefined
      current -= delta
    }
  }
  return current
}

const NO_NEW_ROWS: readonly NewRowPlace[] = []

/** Смена новых строк пачками: сначала ушедшие, затем пришедшие (ADR 0178, DR50). */
export const newRowChanges = (
  previous: readonly NewRowPlace[],
  next: readonly NewRowPlace[],
): RowListChange[][] => {
  const before = new Set(previous.map(row => row.id))
  const after = new Set(next.map(row => row.id))
  const removed = previous
    .filter(row => !after.has(row.id))
    .map(row => ({ at: row.index, delta: -1 }))
  // Место пришедшей — среди пришедших выше: пачка считается в индексах до неё.
  const added = next
    .filter(row => !before.has(row.id))
    .sort((a, b) => a.index - b.index)
    .map((row, position) => ({ at: row.index - position, delta: 1 }))
  return [removed, added].filter(batch => batch.length > 0)
}

interface FollowTable {
  store: {
    get: () => Record<string, unknown>
    subscribe: (listener: () => void) => { unsubscribe: () => void }
  }
}

/** Срезы выборки: их смена — новая выборка строк (ADR 0146, §6). */
const QUERY_SLICES = ['sorting', 'columnFilters', 'globalFilter', 'grouping']

export interface RowListFollower {
  /** Есть ли что сдвигать: без этого смены не считаются. */
  active: () => boolean
  /** Новая выборка или смена, которую не разложить на сдвиги. */
  reset: () => void
  /** Смены списка пачками после прошлой раскладки. */
  shift: (batches: readonly (readonly RowListChange[])[]) => void
  /** Новые строки слоя пришли или ушли; журнал смен о них не знает (ADR 0178, DR50). */
  newRows?: (batches: readonly (readonly RowListChange[])[]) => void
}

/** Подписка на смены списка серверной модели; у клиентского источника — без действия. */
export const followRowList = (table: unknown, follower: RowListFollower) => {
  const t = table as FollowTable
  let seen:
    | {
        epoch: number
        version: number
        query: unknown[]
        newRows: readonly NewRowPlace[]
      }
    | undefined
  const check = () => {
    const source = rowSourceOf(table)
    if (!source.keyByIndex) {
      seen = undefined
      return
    }
    const state = t.store.get()
    const query = QUERY_SLICES.map(key => state[key])
    const epoch = source.epoch?.() ?? 0
    const version = source.version?.() ?? 0
    const newRows = source.newRows?.() ?? NO_NEW_ROWS
    const before = seen
    seen = { epoch, version, query, newRows }
    if (!before || !follower.active()) return
    if (
      before.epoch !== epoch ||
      query.some((value, index) => value !== before.query[index])
    ) {
      follower.reset()
      return
    }
    const moved = newRowChanges(before.newRows, newRows)
    const batches =
      before.version === version ? [] : source.changesSince?.(before.version)
    if (!batches) follower.reset()
    // Новая строка ушла из слоя в кэш: уход и запись — одна смена, а не вставка в диапазон.
    else if (moved.length > 0 && follower.newRows)
      follower.newRows([...moved, ...batches])
    else if (batches.length > 0) follower.shift(batches)
  }
  const subscription = t.store.subscribe(check)
  return () => subscription.unsubscribe()
}
