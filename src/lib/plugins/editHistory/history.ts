/**
 * Стек истории правок (ADR 0222): записи — сохранённые операции записи в ячейки и записи
 * приложения; отмена и повтор — компенсирующая запись тем же каналом (§3), по одной, после
 * ждущих сохранений (§4). Стек живёт вне store, по таблице; в срезе плагина — только счётчики:
 * размер состояния не растёт с числом правок (ADR 0092, LK13).
 */
import { announceLabel } from '../../core/announcer'
import {
  cancelPending,
  hasPending,
  registerPending,
} from '../../core/cancellation'
import {
  type CellsWritten,
  type RowPlace,
  type WrittenCell,
  type WrittenMove,
  type WrittenRow,
  cellWriterOf,
  rowMoverOf,
  shownCellValue,
  writeCells,
} from '../../core/cellWrites'
import { setPluginState } from '../../core/definePlugin'
import { reportAction, type DebugActionSource } from '../../core/debugActions'
import { getDisplayColumns } from '../../core/displayColumns'
import { flashOutcome } from '../../core/flashes/flashFeature'
import {
  reportFailure,
  resolveFailure,
} from '../../core/failures/failuresFeature'
import type { HighlightTarget } from '../../core/highlights/highlightFeature'
import { actionLabelOf } from '../../core/actions'
import { ENGLISH_LABELS, type TableLabels } from '../../core/localization'
import { announcerLabels } from '../../core/announcer'
import { rowSourceOf } from '../../core/rowSource'
import { scrollToRow } from '../../core/scrollToRow/scrollToRowFeature'
import { readServerAction, writeServerAction } from '../../core/serverActions'
import { sameCellValue, type CompareColumn } from '../../shared/cellValues'
import { objectTargetText } from '../../shared/objectTarget'
import { editHistoryLabels } from './labels'

export const ID = 'editHistory'

/** Запись приложения (ADR 0222, §12). */
export interface AppHistoryEntry {
  label: string
  /** Цель «Показать» и выделения. */
  target?: HighlightTarget
  undo: (context: { signal: AbortSignal }) => unknown
  redo: (context: { signal: AbortSignal }) => unknown
}

export type EditHistorySource = CellsWritten['source'] | 'app'

/** Запись истории для приложения и попапа. */
export interface EditHistoryEntry {
  id: string
  label: string
  source: EditHistorySource
  time: number
  /** Ячеек в записи; у записи приложения — 0. */
  cells: number
  target?: HighlightTarget
}

/** Срез плагина: счётчики для перерисовки кнопок и попапа. */
export interface EditHistorySlice {
  size: number
  position: number
  busy: boolean
  /** Шаг, который сейчас идёт. */
  running?: 'undo' | 'redo'
  version: number
}

export const EMPTY_SLICE: EditHistorySlice = {
  size: 0,
  position: 0,
  busy: false,
  version: 0,
}

export interface EditHistoryState {
  /** От старых к новым. */
  entries: readonly EditHistoryEntry[]
  /** Число выполненных записей: `entries[position - 1]` отменяется следующей. */
  position: number
  busy: boolean
}

export interface EditHistoryConfig {
  limit: number
  conflict: 'skip' | 'overwrite'
}

interface Entry {
  id: string
  source: EditHistorySource
  time: number
  cells: readonly WrittenCell[]
  app?: AppHistoryEntry
  /** Серверная модель: место строки в списке при записи — догрузка под шаг (§7). */
  indexes?: ReadonlyMap<string, number>
  /** Строки до сохранения (§13). */
  rows?: readonly WrittenRow[]
  /** Перенос строки (§13). */
  move?: WrittenMove
}

interface Stack {
  entries: Entry[]
  position: number
  chain: Promise<unknown>
  busy: number
  running?: Direction
  version: number
  /** Итог своей записи — отмены или повтора. */
  own?: (record: CellsWritten) => void
  /** Ждут конца сохранений перед отменой. */
  waiters: Set<() => void>
  /**
   * Эхо последней сохранённой записи: прежнее и новое значение ячеек, пока данные приложения
   * не приняли записанное (React-состояние приложения обновится позже) — не конфликт.
   */
  echo: Map<string, { stale: unknown; fresh: unknown }>
  /** Эхо последнего переноса: прежнее место строки ещё в данных приложения — не конфликт. */
  moveEcho?: { rowId: string; stale: RowPlace; fresh: RowPlace }
}

const stacks = new WeakMap<object, Stack>()
let entries = 0

const storeOf = (table: unknown) =>
  (table as { store?: object }).store ?? (table as object)

const stackOf = (table: unknown): Stack => {
  const key = storeOf(table)
  let stack = stacks.get(key)
  if (!stack) {
    stack = {
      entries: [],
      position: 0,
      chain: Promise.resolve(),
      busy: 0,
      version: 0,
      waiters: new Set(),
      echo: new Map(),
    }
    stacks.set(key, stack)
  }
  return stack
}

type ConfigTable = {
  options: {
    editHistoryLimit?: number
    editHistoryConflict?: 'skip' | 'overwrite'
  }
}

const configOf = (table: unknown): EditHistoryConfig => {
  const { options } = table as ConfigTable
  return {
    limit: Math.max(1, options.editHistoryLimit ?? 30),
    conflict: options.editHistoryConflict ?? 'skip',
  }
}

const publish = (table: unknown) => {
  const stack = stackOf(table)
  setPluginState(table, ID, {
    size: stack.entries.length,
    position: stack.position,
    busy: stack.busy > 0,
    ...(stack.running ? { running: stack.running } : {}),
    version: ++stack.version,
  } satisfies EditHistorySlice)
}

const keyOf = (cell: { rowId: string; columnId: string }) =>
  `${cell.rowId}\u0000${cell.columnId}`

// --- Подписи ------------------------------------------------------------------------

/** Действие справочника по источнику записи (ADR 0219, §8). */
const actionOfSource = (source: EditHistorySource) =>
  source === 'fill'
    ? { plugin: 'cellSelection', action: 'fill' }
    : {
        plugin: 'cellEditing',
        action:
          source === 'paste' ||
          source === 'cut' ||
          source === 'clear' ||
          source === 'fillDown' ||
          source === 'fillRight' ||
          source === 'edit'
            ? source
            : source === 'bulk'
              ? 'bulkEdit'
              : 'write',
      }

const entryLabel = (table: unknown, entry: Entry, labels: TableLabels) => {
  if (entry.app) return entry.app.label
  const own = editHistoryLabels(labels)
  const rowId = entry.move?.rowId ?? entry.rows?.[0]?.rowId
  if (rowId !== undefined) {
    const action = entry.move
      ? { plugin: 'rowDragging', action: 'commitMove' }
      : {
          plugin: 'cellEditing',
          action:
            entry.rows![0]!.change === 'insert' ? 'rowInsert' : 'rowDelete',
        }
    return own.entryCell(
      actionLabelOf(table, action, labels),
      objectTargetText(table, { row: rowId }, labels),
    )
  }
  const name = actionLabelOf(table, actionOfSource(entry.source), labels)
  const [first] = entry.cells
  return entry.cells.length === 1 && first
    ? own.entryCell(
        name,
        objectTargetText(
          table,
          { cell: [first.rowId, first.columnId] },
          labels,
        ),
      )
    : own.entryCells(name, entry.cells.length)
}

const labelsOf = (table: unknown) => announcerLabels(table) ?? ENGLISH_LABELS

/** Цель записи: ячейка или прямоугольник от первой ячейки операции до последней. */
const targetOfEntry = (entry: Entry): HighlightTarget | undefined => {
  if (entry.app) return entry.app.target
  const rowId = entry.move?.rowId ?? entry.rows?.[0]?.rowId
  if (rowId !== undefined) return { row: rowId }
  const first = entry.cells[0]
  const last = entry.cells[entry.cells.length - 1]
  if (!first || !last) return undefined
  return first === last
    ? { cell: [first.rowId, first.columnId] }
    : {
        range: {
          anchorRowId: first.rowId,
          anchorColumnId: first.columnId,
          focusRowId: last.rowId,
          focusColumnId: last.columnId,
        },
      }
}

// --- Чтение ----------------------------------------------------------------------

/** Состояние истории с подписями на языке таблицы. */
export const historyOf = (
  table: unknown,
  labels: TableLabels = labelsOf(table),
): EditHistoryState => {
  const stack = stackOf(table)
  return {
    entries: stack.entries.map(entry => ({
      id: entry.id,
      label: entryLabel(table, entry, labels),
      source: entry.source,
      time: entry.time,
      cells: entry.cells.length,
      ...(targetOfEntry(entry) ? { target: targetOfEntry(entry) } : {}),
    })),
    position: stack.position,
    busy: stack.busy > 0,
  }
}

export const canUndo = (table: unknown) => stackOf(table).position > 0

export const canRedo = (table: unknown) => {
  const stack = stackOf(table)
  return stack.position < stack.entries.length
}

/** Подпись записи, которую отменит или повторит следующий шаг. */
export const nextLabel = (
  table: unknown,
  direction: 'undo' | 'redo',
  labels: TableLabels,
) => {
  const stack = stackOf(table)
  const entry =
    stack.entries[direction === 'undo' ? stack.position - 1 : stack.position]
  return entry ? entryLabel(table, entry, labels) : undefined
}

// --- Запись -----------------------------------------------------------------------

const push = (table: unknown, entry: Entry) => {
  const stack = stackOf(table)
  stack.entries = stack.entries.slice(0, stack.position)
  stack.entries.push(entry)
  const { limit } = configOf(table)
  if (stack.entries.length > limit)
    stack.entries.splice(0, stack.entries.length - limit)
  stack.position = stack.entries.length
  publish(table)
}

/** Эхо записи: прежнее значение ячейки ещё в данных — не конфликт (§6). */
const remember = (
  table: unknown,
  cells: readonly WrittenCell[],
  direction: Direction,
) => {
  const echo = new Map<string, { stale: unknown; fresh: unknown }>()
  for (const cell of cells)
    echo.set(
      keyOf(cell),
      direction === 'undo'
        ? { stale: cell.after, fresh: cell.before }
        : { stale: cell.before, fresh: cell.after },
    )
  stackOf(table).echo = echo
}

/**
 * Итог записи в ячейки (§2): сохранённая операция — запись; итог своей отмены или повтора —
 * их ожиданию. Каждый итог проверяет ждущих конца сохранений (§4).
 */
export const recordWritten = (table: unknown, record: CellsWritten) => {
  const stack = stackOf(table)
  if (record.source === 'undo' || record.source === 'redo') {
    if (stack.own) stack.own(record)
    else settleLate(table, record)
  } else if (record.rows && record.rows.length > 0) {
    push(table, {
      id: `history-${++entries}`,
      source: record.source,
      time: Date.now(),
      cells: [],
      rows: record.rows,
    })
  } else if (record.move) {
    stack.moveEcho = {
      rowId: record.move.rowId,
      stale: record.move.from,
      fresh: record.move.to,
    }
    push(table, {
      id: `history-${++entries}`,
      source: record.source,
      time: Date.now(),
      cells: [],
      move: record.move,
    })
  } else if (record.cells.length > 0) {
    remember(table, record.cells, 'redo')
    const source = rowSourceOf<{ id: string }>(table)
    const indexes = source.keyByIndex
      ? new Map(
          [...new Set(record.cells.map(cell => cell.rowId))].map(id => [
            id,
            source.indexOf(id),
          ]),
        )
      : undefined
    push(table, {
      id: `history-${++entries}`,
      source: record.source,
      time: Date.now(),
      cells: record.cells,
      ...(indexes ? { indexes } : {}),
    })
  }
  for (const waiter of [...stack.waiters]) waiter()
}

/**
 * Итог отмены или повтора вне шага — «Повторить» на плашке отказа пакета (§5): сохранённые
 * ячейки — те же, что у записи на месте шага, — двигают позицию, как сделанный шаг.
 */
const settleLate = (table: unknown, record: CellsWritten) => {
  if (record.cells.length === 0) return
  const stack = stackOf(table)
  const undo = record.source === 'undo'
  const entry = stack.entries[undo ? stack.position - 1 : stack.position]
  if (!entry) return
  const keys = new Set(entry.cells.map(keyOf))
  if (!record.cells.every(cell => keys.has(keyOf(cell)))) return
  stack.position += undo ? -1 : 1
  remember(table, entry.cells, undo ? 'undo' : 'redo')
  publish(table)
}

/** Своя запись приложения (§12); возвращает id записи. */
export const pushHistory = (table: unknown, app: AppHistoryEntry) => {
  const id = `history-${++entries}`
  push(table, { id, source: 'app', time: Date.now(), cells: [], app })
  return id
}

export const clearHistory = (table: unknown) => {
  const stack = stackOf(table)
  stack.entries = []
  stack.position = 0
  publish(table)
}

// --- Отмена и повтор -------------------------------------------------------------

/** Конец ждущих сохранений правки (§4): своя очередь их не создаёт, пока ждёт. */
const savesSettled = (table: unknown) =>
  new Promise<void>(resolve => {
    const stack = stackOf(table)
    const check = () => {
      if (hasPending(table, { kind: 'cellEdit' })) return
      stack.waiters.delete(check)
      resolve()
    }
    stack.waiters.add(check)
    check()
  })

type Direction = 'undo' | 'redo'

interface ColumnsTable {
  getColumn: (id: string) => CompareColumn | undefined
}

/** Ячейки записи, которые можно писать: строка и колонка есть, значение не менялось извне. */
const prepare = (
  table: unknown,
  entry: Entry,
  direction: Direction,
  loaded: ReadonlyMap<string, LoadedRow>,
) => {
  const source = rowSourceOf<{ id: string }>(table)
  const { conflict } = configOf(table)
  const { echo } = stackOf(table)
  const writes: WrittenCell[] = []
  let changed = 0
  let missing = 0
  for (const cell of entry.cells) {
    const column = (table as ColumnsTable).getColumn(cell.columnId)
    const fetched = loaded.get(cell.rowId)
    if (!column || (!source.byId(cell.rowId) && !fetched)) {
      missing++
      continue
    }
    const expected = direction === 'undo' ? cell.after : cell.before
    const now = fetched
      ? fetched.getValue(cell.columnId)
      : shownCellValue(table, cell.rowId, cell.columnId)
    const pending = echo.get(keyOf(cell))
    const same =
      sameCellValue(table, column, now, expected) ||
      (pending !== undefined &&
        sameCellValue(table, column, now, pending.stale) &&
        sameCellValue(table, column, expected, pending.fresh))
    if (conflict === 'skip' && !same) {
      changed++
      continue
    }
    writes.push(cell)
  }
  return { writes, changed, missing }
}

/**
 * Выделить ячейки записи и прокрутить к ним (§9); скрытые — объявить. `show` — «Показать» (§11):
 * область по центру и вспышка, как у «Показать» журнала отказов и пульта.
 */
const reveal = (
  table: unknown,
  cells: readonly WrittenCell[],
  indexes?: ReadonlyMap<string, number>,
  show = false,
) => {
  const source = rowSourceOf<{ id: string }>(table)
  const columns = getDisplayColumns(
    table as Parameters<typeof getDisplayColumns>[0],
  ).ids
  let top: { index: number; id: string } | undefined
  let bottom: { index: number; id: string } | undefined
  let left: { index: number; id: string } | undefined
  let right: { index: number; id: string } | undefined
  let hidden = false
  for (const cell of cells) {
    // Серверная модель: строки, ушедшей из кэша, в списке нет — место из записи (§7).
    const listed = source.indexOf(cell.rowId)
    const row =
      listed < 0 && source.keyByIndex
        ? (indexes?.get(cell.rowId) ?? -1)
        : listed
    const column = columns.indexOf(cell.columnId)
    if (row < 0 || column < 0) {
      hidden = true
      continue
    }
    if (!top || row < top.index) top = { index: row, id: cell.rowId }
    if (!bottom || row > bottom.index) bottom = { index: row, id: cell.rowId }
    if (!left || column < left.index)
      left = { index: column, id: cell.columnId }
    if (!right || column > right.index)
      right = { index: column, id: cell.columnId }
  }
  if (!top || !bottom || !left || !right) return hidden
  const t = table as {
    setCellSelection?: (updater: () => unknown[]) => void
  }
  t.setCellSelection?.(() => [
    {
      anchorRowId: top.id,
      anchorColumnId: left.id,
      focusRowId: bottom.id,
      focusColumnId: right.id,
    },
  ])
  void scrollToRow(table as never, top.id, {
    columnId: left.id,
    ...(source.keyByIndex ? { index: top.index } : {}),
    ...(show ? { align: 'center' as const } : {}),
  })
  if (show)
    flashOutcome(
      table,
      top === bottom && left === right
        ? { cell: [top.id, left.id] }
        : {
            range: {
              anchorRowId: top.id,
              anchorColumnId: left.id,
              focusRowId: bottom.id,
              focusColumnId: right.id,
            },
          },
      'arrived',
    )
  return hidden
}

/** Пометка шага для общего объявления: несколько объявлений одного кадра живая область теряет. */
type Note = (labels: TableLabels) => string

const skipNotes = ({
  changed,
  missing,
}: {
  changed: number
  missing: number
}) => {
  const notes: Note[] = []
  if (changed > 0)
    notes.push(all => editHistoryLabels(all).announceConflicts(changed))
  if (missing > 0)
    notes.push(all => editHistoryLabels(all).announceMissing(missing))
  return notes
}

interface LoadedRow {
  id: string
  getValue: (columnId: string) => unknown
}

interface LoadSource {
  keyByIndex?: boolean
  byId: (id: string) => unknown
  loadRange?: (
    first: number,
    last: number,
    signal: AbortSignal,
  ) => Promise<readonly (LoadedRow | undefined)[]>
}

/**
 * Строки записи, которых нет в кэше окна серверной модели (§7): догрузка по месту при записи с
 * ожиданием на таблице и отменой; на месте другая строка — новая выборка, её ячейки уйдут как
 * пропавшие. Предела нет: строк не больше, чем в операции, которую уже грузили под пределом
 * выделения (ADR 0219, §7). Отказ блока — плашка с повтором; `undefined` — шага нет.
 */
const loadRows = async (
  table: unknown,
  entry: Entry,
  direction: Direction,
): Promise<ReadonlyMap<string, LoadedRow> | undefined> => {
  const source = rowSourceOf(table) as unknown as LoadSource
  if (!entry.indexes || !source.keyByIndex || !source.loadRange)
    return new Map<string, LoadedRow>()
  const wanted = [...entry.indexes].filter(
    ([id, index]) => index >= 0 && !source.byId(id),
  )
  if (wanted.length === 0) return new Map<string, LoadedRow>()
  const fail = (error: unknown) =>
    writeServerAction(table, status => ({
      ...status,
      failed: {
        kind: direction,
        attempt: (readServerAction(table).failed?.attempt ?? 0) + 1,
        error,
        retry: () => void step(table, direction, 'api'),
      },
    }))
  const controller = new AbortController()
  const unregister = registerPending(table, {
    kind: 'history',
    id: 'rows',
    cancel: () => controller.abort(),
  })
  writeServerAction(table, status => ({
    ...status,
    loadingRows: { kind: direction, since: performance.now() },
  }))
  const loaded = new Map<string, LoadedRow>()
  // «Стоп» заканчивает ожидание, даже если источник не слушает `signal`.
  const stopped = new Promise<never>((_, reject) =>
    controller.signal.addEventListener(
      'abort',
      () => reject(new Error('aborted')),
      {
        once: true,
      },
    ),
  )
  stopped.catch(() => undefined)
  try {
    const sorted = wanted.sort((a, b) => a[1] - b[1])
    for (let i = 0; i < sorted.length;) {
      let j = i
      while (j + 1 < sorted.length && sorted[j + 1]![1] === sorted[j]![1] + 1)
        j++
      const first = sorted[i]![1]
      const rows = await Promise.race([
        source.loadRange(first, sorted[j]![1], controller.signal),
        stopped,
      ])
      controller.signal.throwIfAborted()
      for (let k = i; k <= j; k++) {
        const row = rows[sorted[k]![1] - first]
        if (row && row.id === sorted[k]![0]) loaded.set(row.id, row)
      }
      i = j + 1
    }
    return loaded
  } catch (error) {
    if (!controller.signal.aborted) fail(error)
    return undefined
  } finally {
    unregister()
    writeServerAction(table, ({ loadingRows: _rows, ...status }) => ({
      ...status,
      loadingRows: undefined,
    }))
  }
}

/** Записать ячейки обратно и дождаться итога своей записи. */
const writeBack = async (
  table: unknown,
  cells: readonly WrittenCell[],
  direction: Direction,
  rows: ReadonlyMap<string, LoadedRow>,
): Promise<CellsWritten | 'none'> => {
  const stack = stackOf(table)
  let settled: CellsWritten | undefined
  let resolve: (record: CellsWritten) => void = () => {}
  const done = new Promise<CellsWritten>(r => (resolve = r))
  stack.own = record => {
    settled = record
    resolve(record)
  }
  try {
    const report = await writeCells(
      table,
      cells.map(cell => ({
        rowId: cell.rowId,
        columnId: cell.columnId,
        value: direction === 'undo' ? cell.before : cell.after,
      })),
      rows.size > 0 ? { source: direction, rows } : { source: direction },
    )
    if (!report || report.written === 0) return 'none'
    return settled ?? (await done)
  } finally {
    stack.own = undefined
  }
}

/** Отмена или повтор записи ячеек; `true` — запись сделала шаг. */
const stepCells = async (
  table: unknown,
  entry: Entry,
  index: number,
  direction: Direction,
  notes: Note[],
) => {
  const stack = stackOf(table)
  const loaded = await loadRows(table, entry, direction)
  if (!loaded) return false
  const { writes, changed, missing } = prepare(table, entry, direction, loaded)
  notes.push(...skipNotes({ changed, missing }))
  if (writes.length === 0) {
    // Записи без ячеек нечего отменять — она уходит (§6).
    stack.entries.splice(index, 1)
    if (direction === 'undo') stack.position--
    publish(table)
    return false
  }
  const result = await writeBack(table, writes, direction, loaded)
  if (result === 'none') {
    notes.push(all => editHistoryLabels(all).announceNotWritable(writes.length))
    return false
  }
  if (result.cancelled && result.cells.length === 0) return false
  const saved = new Set(result.cells.map(keyOf))
  const done = writes.filter(cell => saved.has(keyOf(cell)))
  const rest = writes.filter(cell => !saved.has(keyOf(cell)))
  if (done.length === 0) {
    stack.entries[index] = { ...entry, cells: writes }
    publish(table)
    return false
  }
  // Частичный отказ: отказанные ячейки остаются на месте записи, сохранённые — шагом (§5).
  const moved = { ...entry, cells: done }
  const left = { ...entry, id: `history-${++entries}`, cells: rest }
  if (direction === 'undo') {
    stack.entries.splice(index, 1, ...(rest.length ? [left, moved] : [moved]))
    if (!rest.length) stack.position--
  } else {
    stack.entries.splice(index, 1, ...(rest.length ? [moved, left] : [moved]))
    stack.position++
  }
  remember(table, done, direction)
  publish(table)
  if (reveal(table, done, entry.indexes))
    notes.push(all => editHistoryLabels(all).announceHidden)
  return true
}

/** Ключ отказа записи приложения: отказ снимается, когда шаг той же записи прошёл. */
const failureKeyOfEntry = (entry: Entry) => `${ID}:${entry.id}`

/** Строки до сохранения (§13): черновики меняются сразу, без сервера и без конфликта. */
const stepRows = (
  table: unknown,
  entry: Entry,
  direction: Direction,
  notes: Note[],
) => {
  const writer = cellWriterOf(table)
  if (!writer) {
    notes.push(all =>
      editHistoryLabels(all).announceNotWritable(entry.rows!.length),
    )
    return false
  }
  writer.writeRows(
    table,
    entry.rows!.map(row =>
      direction === 'undo'
        ? { ...row, change: row.change === 'insert' ? 'delete' : 'insert' }
        : row,
    ),
  )
  const stack = stackOf(table)
  stack.position += direction === 'undo' ? -1 : 1
  publish(table)
  void scrollToRow(table as never, entry.rows![0]!.rowId)
  return true
}

const samePlace = (now: RowPlace, expected: RowPlace) =>
  now.parentId === expected.parentId &&
  (now.index < 0 || expected.index < 0 || now.index === expected.index)

/**
 * Перенос обратно или снова (§13): тем же путём, что бросок; строка не на месте после переноса —
 * пропуск с объявлением, запись уходит (§6). Ждёт итога колбэка: отказ — запись на месте.
 */
const stepMove = async (
  table: unknown,
  entry: Entry,
  index: number,
  direction: Direction,
  notes: Note[],
) => {
  const stack = stackOf(table)
  const mover = rowMoverOf(table)
  const move = entry.move!
  if (!mover) {
    notes.push(all => editHistoryLabels(all).announceNotWritable(1))
    return false
  }
  const expected = direction === 'undo' ? move.to : move.from
  const target = direction === 'undo' ? move.from : move.to
  const now = mover.placeOf(table, move.rowId)
  const echo = stack.moveEcho
  const inPlace =
    !!now &&
    (samePlace(now, expected) ||
      (echo?.rowId === move.rowId &&
        samePlace(now, echo.stale) &&
        samePlace(expected, echo.fresh)))
  if (!inPlace && configOf(table).conflict === 'skip') {
    stack.entries.splice(index, 1)
    if (direction === 'undo') stack.position--
    publish(table)
    notes.push(all => editHistoryLabels(all).announceMoveSkipped)
    return false
  }
  let resolve: (record: CellsWritten) => void = () => {}
  let settled: CellsWritten | undefined
  const done = new Promise<CellsWritten>(r => (resolve = r))
  stack.own = record => {
    settled = record
    resolve(record)
  }
  try {
    if (!mover.move(table, move.rowId, target, direction)) {
      notes.push(all => editHistoryLabels(all).announceNotWritable(1))
      return false
    }
    const record = settled ?? (await done)
    if (record.failed || record.cancelled || !record.move) return false
  } finally {
    stack.own = undefined
  }
  stack.moveEcho = { rowId: move.rowId, stale: expected, fresh: target }
  stack.position += direction === 'undo' ? -1 : 1
  publish(table)
  void scrollToRow(table as never, move.rowId)
  return true
}

/** Отмена или повтор записи приложения: промис ждёт, отказ — отказ на объекте (§12). */
const stepApp = async (table: unknown, entry: Entry, direction: Direction) => {
  const app = entry.app!
  const controller = new AbortController()
  const unregister = registerPending(table, {
    kind: 'history',
    id: entry.id,
    cancel: () => controller.abort(),
  })
  // «Стоп» заканчивает шаг, даже если промис приложения не слушает `signal`.
  const stopped = new Promise<void>(resolve =>
    controller.signal.addEventListener('abort', () => resolve(), {
      once: true,
    }),
  )
  try {
    await Promise.race([
      (direction === 'undo' ? app.undo : app.redo)({
        signal: controller.signal,
      }),
      stopped,
    ])
    if (controller.signal.aborted) return false
  } catch (error) {
    if (controller.signal.aborted) return false
    const reason = error instanceof Error ? error.message : String(error ?? '')
    reportFailure(table, {
      key: failureKeyOfEntry(entry),
      action: { plugin: ID, action: direction },
      target: app.target ?? { table: true },
      reason,
      retry: () => void step(table, direction, 'api'),
    })
    return false
  } finally {
    unregister()
  }
  resolveFailure(table, failureKeyOfEntry(entry))
  const stack = stackOf(table)
  stack.position += direction === 'undo' ? -1 : 1
  publish(table)
  return true
}

/** Шаг истории в очереди (§4): после ждущих сохранений и прежних шагов. */
export const step = (
  table: unknown,
  direction: Direction,
  source: DebugActionSource,
): Promise<boolean> => {
  const stack = stackOf(table)
  stack.busy++
  // Ожидание на кнопке и «стоп» — с нажатия, а не с конца ждущих сохранений (§4).
  if (!stack.running) stack.running = direction
  publish(table)
  const queued = new AbortController()
  const unregister = registerPending(table, {
    kind: 'history',
    id: 'queued',
    cancel: () => queued.abort(),
  })
  const stopped = new Promise<void>(resolve =>
    queued.signal.addEventListener('abort', () => resolve(), { once: true }),
  )
  const run = async () => {
    await Promise.race([savesSettled(table), stopped])
    unregister()
    if (queued.signal.aborted) return false
    stack.running = direction
    publish(table)
    const index = direction === 'undo' ? stack.position - 1 : stack.position
    const entry = stack.entries[index]
    if (!entry) {
      announceLabel(table, all =>
        direction === 'undo'
          ? editHistoryLabels(all).announceNothing
          : editHistoryLabels(all).announceNothingToRedo,
      )
      return false
    }
    const labels = labelsOf(table)
    const label = entryLabel(table, entry, labels)
    reportAction(table, {
      plugin: ID,
      action: direction,
      detail: { id: entry.id },
      source,
    })
    const notes: Note[] = []
    const ok = entry.app
      ? await stepApp(table, entry, direction)
      : entry.rows
        ? stepRows(table, entry, direction, notes)
        : entry.move
          ? await stepMove(table, entry, index, direction, notes)
          : await stepCells(table, entry, index, direction, notes)
    if (ok || notes.length > 0)
      announceLabel(table, all =>
        [
          ...(ok
            ? [
                direction === 'undo'
                  ? editHistoryLabels(all).announceUndone(label)
                  : editHistoryLabels(all).announceRedone(label),
              ]
            : []),
          ...notes.map(note => note(all)),
        ].join('. '),
      )
    return ok
  }
  const result = stack.chain.then(run, run)
  stack.chain = result.catch(() => undefined)
  return result.finally(() => {
    stack.running = undefined
    stack.busy--
    publish(table)
  })
}

/**
 * Откат или повтор до записи (§11): шаги по очереди, остановка на первом, что не сделал шаг.
 * Выполненная запись — откат так, чтобы она осталась последней выполненной; откаченная — повтор
 * до неё включительно.
 */
/** Откат или повтор до записи (§11); `null` — откат всех записей, к виду до первой правки. */
export const rewind = async (
  table: unknown,
  entryId: string | null,
  source: DebugActionSource,
): Promise<boolean> => {
  const stack = stackOf(table)
  reportAction(table, {
    plugin: ID,
    action: 'rewind',
    detail: { id: entryId },
    source,
  })
  if (entryId === null) {
    while (stack.position > 0)
      if (!(await step(table, 'undo', source))) return false
    return true
  }
  for (;;) {
    const index = stack.entries.findIndex(entry => entry.id === entryId)
    if (index < 0) return false
    if (index < stack.position - 1) {
      if (!(await step(table, 'undo', source))) return false
    } else if (index >= stack.position) {
      if (!(await step(table, 'redo', source))) return false
    } else return true
  }
}

/** «Стоп» ждущего шага: своя запись ячеек и запись приложения. */
export const cancelStep = (table: unknown) => {
  cancelPending(table, { kind: 'history' })
  if (stackOf(table).own) cancelPending(table, { kind: 'cellEdit' })
}

/** Показать ячейки записи без отката (§11). */
export const showEntry = (table: unknown, entryId: string) => {
  const entry = stackOf(table).entries.find(item => item.id === entryId)
  if (
    entry &&
    entry.cells.length > 0 &&
    reveal(table, entry.cells, entry.indexes, true)
  )
    announceLabel(table, all => editHistoryLabels(all).announceHidden)
}
