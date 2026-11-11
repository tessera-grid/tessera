/**
 * Место строки среди строк её уровня в данных (ADR 0200, §5): хранилище знает его и после
 * вставки, удаления и переноса в середине. `row.index` — место при создании строки, его
 * получает `accessorFn`; позицию модули читают отсюда.
 *
 * Места строк, сдвинутых сменой `data`, записываются при записи места, в простое или при чтении
 * места, которое не нашлось в новом списке, а не при смене (ADR 0211).
 */
const positions = new WeakMap<object, number>()

/** Отложенные места: строки `rows` с индекса `from` стоят на своих индексах. */
interface Deferred {
  rows: readonly object[]
  from: number
  /** Сдвиг конца списка с последней записи мест: прежнее место строки конца + `shift`. */
  shift: number
}

const deferred = new WeakMap<object, Deferred>()
/** Сколько таблиц с отложенными местами; ноль — чтение без поиска таблицы строки. */
let deferredTables = 0

type TableKey = { store?: object }

const keyOfTable = (table: unknown): object | undefined => {
  const t = table as TableKey | undefined
  return t ? (t.store ?? t) : undefined
}

const write = (row: object, position: number) => {
  if ((row as { index?: number }).index === position) positions.delete(row)
  else positions.set(row, position)
}

const settleKey = (key: object | undefined) => {
  if (!key) return
  const pending = deferred.get(key)
  if (!pending) return
  deferred.delete(key)
  deferredTables--
  const { rows, from } = pending
  for (let i = from; i < rows.length; i++) write(rows[i]!, i)
}

/**
 * Таблица последней прочитанной строки без отложенных мест: её строки читаются без поиска. Ссылка
 * слабая — ушедшая таблица не держится в памяти.
 */
let settled: WeakRef<object> | undefined

/** Отложенное таблицы строки; таблица без него запоминается. */
const pendingOf = (row: object) => {
  // Прототип строки TanStack хранит таблицу.
  const table = (row as { table?: unknown }).table
  if (settled !== undefined && settled.deref() === table) return undefined
  const key = keyOfTable(table)
  const pending = key && deferred.get(key)
  if (!pending) remember(table)
  return pending ? { key: key!, pending, table } : undefined
}

const remember = (table: unknown) => {
  settled = typeof table === 'object' && table ? new WeakRef(table) : undefined
}

const settleRow = (row: object) => {
  if (!deferredTables) return
  const found = pendingOf(row)
  if (!found) return
  settleKey(found.key)
  remember(found.table)
}

/** У таблицы есть отложенные места. */
export const hasDeferredPositions = (table: unknown): boolean => {
  const key = keyOfTable(table)
  return !!key && deferred.has(key)
}

/** Записать отложенные места строк таблицы. */
export const settlePositions = (table: unknown) => {
  if (deferredTables) settleKey(keyOfTable(table))
}

/**
 * Места строк `rows` с индекса `from` — их индексы; запись — при первом обращении к местам строк
 * таблицы. `previous` — список, из которого собран `rows`: отложенные места прежнего списка
 * сливаются, его начало до `from` стоит на тех же местах.
 */
export const deferPositions = (
  table: unknown,
  rows: readonly object[],
  from: number,
  previous: readonly object[],
  shift: number,
) => {
  const key = keyOfTable(table)
  if (!key) {
    for (let i = from; i < rows.length; i++) write(rows[i]!, i)
    return
  }
  const pending = deferred.get(key)
  if (pending && pending.rows === previous) {
    deferred.set(key, {
      rows,
      from: Math.min(from, pending.from),
      shift: pending.shift + shift,
    })
    return
  }
  settleKey(key)
  if (from >= rows.length) return
  deferred.set(key, { rows, from, shift })
  deferredTables++
  settled = undefined
  // Дописать в простое: чтение мест других таблиц не платит за поиск таблицы строки. Ссылка
  // слабая — ушедшая таблица не ждёт простоя в памяти.
  const ref = new WeakRef(key)
  whenIdle(() => {
    const target = ref.deref()
    if (target) settleKey(target)
  })
}

const whenIdle = (task: () => void) => {
  const idle = (
    globalThis as { requestIdleCallback?: (cb: () => void) => void }
  ).requestIdleCallback
  if (idle) idle(task)
  else setTimeout(task, 0)
}

export const positionOf = (row: { index: number }): number => {
  const known = positions.get(row) ?? row.index
  if (!deferredTables) return known
  const found = pendingOf(row)
  if (!found) return known
  // Строка на прежнем месте или на прежнем со сдвигом конца — место подтверждает новый список.
  const { rows, shift } = found.pending
  if (rows[known] === row) return known
  if (rows[known + shift] === row) return known + shift
  settleKey(found.key)
  remember(found.table)
  return positions.get(row) ?? row.index
}

/** Новое место строки без правки самой строки; место, равное `index`, записи не держит. */
export const setPosition = (row: object, position: number) => {
  settleRow(row)
  write(row, position)
}

/** Место строки — её копии с тем же `index`: запись переходит, только если она есть. */
export const copyPosition = (from: object, to: object) => {
  settleRow(from)
  const position = positions.get(from)
  if (position !== undefined) positions.set(to, position)
}
