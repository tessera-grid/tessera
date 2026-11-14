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
import { readDrafts } from '../../core/drafts/drafts'
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
  /** Цель вспышки и выделения. */
  target?: HighlightTarget
  undo: (context: { signal: AbortSignal }) => unknown
  redo: (context: { signal: AbortSignal }) => unknown
}

export type EditHistorySource = CellsWritten['source'] | 'app'

/**
 * Изменение, которое история может записать (ADR 0222, §16): вид, ячейки, строки и перенос; у
 * записи приложения — её подпись.
 */
export interface EditHistoryChange {
  source: Exclude<EditHistorySource, 'undo' | 'redo' | 'apply'>
  cells: readonly WrittenCell[]
  rows?: readonly WrittenRow[]
  move?: WrittenMove
  label?: string
}

/** Запись истории для приложения и попапа. */
export interface EditHistoryEntry {
  id: string
  /** Подпись одной строкой: действие и цель. */
  label: string
  /** Действие записи — первая строка пункта попапа. */
  action: string
  /** Цель — ячейка, строка или число ячеек — вторая строка пункта. */
  detail?: string
  source: EditHistorySource
  time: number
  /** Ячеек в записи; у записи приложения — 0. */
  cells: number
  target?: HighlightTarget
  /** Изменения записи ещё не применены — у ячеек и строк есть черновики (§14). */
  unsaved: boolean
}

/** «Применить» после записи `after`: разделитель списка, не шаг (§14). */
export interface EditHistoryApplied {
  after: string
  count: number
  time: number
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
  /** Применения с сохранёнными изменениями, от старых к новым (§14). */
  applied: readonly EditHistoryApplied[]
}

export interface EditHistoryConfig {
  limit: number
  /** Ячеек во всех записях вместе (ADR 0223, §4). */
  maxCells: number
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
  /** Что изменил идущий переход к записи — вспышка после него (§11). */
  changed?: HighlightTarget[]
  /** Разделители «Применено» (§14). */
  applied: EditHistoryApplied[]
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
      applied: [],
    }
    stacks.set(key, stack)
  }
  return stack
}

type ConfigTable = {
  options: {
    editHistorySources?: readonly EditHistorySource[]
    editHistoryCanRecordChange?: (change: EditHistoryChange) => boolean
    editHistoryLimit?: number
    editHistoryMaxCells?: number
    editHistoryConflict?: 'skip' | 'overwrite'
  }
}

/** Ячеек во всей истории по умолчанию (ADR 0223, §4). */
export const DEFAULT_MAX_CELLS = 50_000

const configOf = (table: unknown): EditHistoryConfig => {
  const { options } = table as ConfigTable
  return {
    limit: Math.max(1, options.editHistoryLimit ?? 30),
    maxCells: Math.max(1, options.editHistoryMaxCells ?? DEFAULT_MAX_CELLS),
    conflict: options.editHistoryConflict ?? 'skip',
  }
}

/** Пишется ли изменение (§16): вид в списке `sources` и согласие `canRecordChange`. */
const recordable = (table: unknown, change: EditHistoryChange) => {
  const { options } = table as ConfigTable
  const sources = options.editHistorySources
  if (sources && !sources.includes(change.source)) return false
  return options.editHistoryCanRecordChange?.(change) ?? true
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
              : source === 'discard'
                ? 'cellDraftRollback'
                : 'write',
      }

/** Действие записи и её цель — ячейка или строка — либо число ячеек. */
interface EntryParts {
  action: string
  target?: string
  count?: number
}

const entryParts = (
  table: unknown,
  entry: Entry,
  labels: TableLabels,
): EntryParts => {
  if (entry.app) return { action: entry.app.label }
  const rowId = entry.move?.rowId ?? entry.rows?.[0]?.rowId
  // Отбрасывание одной строки — по строке; с ячейками — числом всего отброшенного (§14).
  if (entry.source === 'discard' && entry.rows && entry.cells.length > 0)
    return {
      action: actionLabelOf(table, actionOfSource('discard'), labels),
      count: entry.cells.length + entry.rows.length,
    }
  if (entry.source === 'discard' && entry.rows?.length === 1) {
    const change = entry.rows[0]!.change
    return {
      action: actionLabelOf(
        table,
        {
          plugin: 'cellEditing',
          action: change === 'delete' ? 'rowInsertDiscard' : 'rowDeleteDiscard',
        },
        labels,
      ),
      target: objectTargetText(table, { row: rowId! }, labels),
    }
  }
  if (rowId !== undefined) {
    const action = entry.move
      ? { plugin: 'rowDragging', action: 'commitMove' }
      : {
          plugin: 'cellEditing',
          action:
            entry.rows![0]!.change === 'insert' ? 'rowInsert' : 'rowDelete',
        }
    return {
      action: actionLabelOf(table, action, labels),
      target: objectTargetText(table, { row: rowId }, labels),
    }
  }
  const action = actionLabelOf(table, actionOfSource(entry.source), labels)
  const [first] = entry.cells
  return entry.cells.length === 1 && first
    ? {
        action,
        target: objectTargetText(
          table,
          { cell: [first.rowId, first.columnId] },
          labels,
        ),
      }
    : { action, count: entry.cells.length }
}

/** Подпись записи одной строкой — для имён кнопок и объявлений. */
const entryLabel = (table: unknown, entry: Entry, labels: TableLabels) => {
  const own = editHistoryLabels(labels)
  const { action, target, count } = entryParts(table, entry, labels)
  if (target !== undefined) return own.entryCell(action, target)
  return count !== undefined ? own.entryCells(action, count) : action
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
  const drafted = draftKeysOf(table)
  return {
    entries: stack.entries.map((entry, index) => {
      const own = editHistoryLabels(labels)
      const { action, target, count } = entryParts(table, entry, labels)
      const detail =
        target ?? (count !== undefined ? own.historyCells(count) : undefined)
      return {
        id: entry.id,
        label: entryLabel(table, entry, labels),
        action,
        ...(detail !== undefined ? { detail } : {}),
        source: entry.source,
        time: entry.time,
        cells: entry.cells.length,
        ...(targetOfEntry(entry) ? { target: targetOfEntry(entry) } : {}),
        unsaved: index < stack.position && hasDrafts(drafted, entry),
      }
    }),
    position: stack.position,
    busy: stack.busy > 0,
    applied: stack.applied,
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

/** Ячеек в записи для предела объёма: строка и перенос — одна, запись приложения — ноль. */
const sizeOfEntry = (entry: Entry) =>
  entry.app
    ? 0
    : (entry.rows?.length ?? 0) + (entry.move ? 1 : 0) + entry.cells.length

/** Ключи ячеек и строк с черновиками (§14). */
const draftKeysOf = (table: unknown) => {
  const keys = new Set<string>()
  for (const draft of readDrafts(table)) {
    if ('cell' in draft.target)
      keys.add(
        keyOf({ rowId: draft.target.cell[0], columnId: draft.target.cell[1] }),
      )
    else if ('row' in draft.target) keys.add(`row:${draft.target.row}`)
  }
  return keys
}

/** У ячеек или строк записи есть черновики — её изменения ещё не применены. */
const hasDrafts = (keys: ReadonlySet<string>, entry: Entry) =>
  keys.size > 0 &&
  (entry.cells.some(cell => keys.has(keyOf(cell))) ||
    !!entry.rows?.some(row => keys.has(`row:${row.rowId}`)))

/** Разделители, чьи записи ушли, уходят вместе с ними (§14). */
const pruneApplied = (stack: Stack) => {
  const ids = new Set(stack.entries.map(entry => entry.id))
  stack.applied = stack.applied.filter(mark => ids.has(mark.after))
}

const push = (table: unknown, entry: Entry) => {
  const stack = stackOf(table)
  stack.entries = stack.entries.slice(0, stack.position)
  pruneApplied(stack)
  stack.entries.push(entry)
  const { limit, maxCells } = configOf(table)
  if (stack.entries.length > limit)
    stack.entries.splice(0, stack.entries.length - limit)
  // Объём истории (ADR 0223, §4): старые записи уходят, пока сумма больше предела; новая — всегда.
  let total = stack.entries.reduce((sum, item) => sum + sizeOfEntry(item), 0)
  while (total > maxCells && stack.entries.length > 1)
    total -= sizeOfEntry(stack.entries.shift()!)
  pruneApplied(stack)
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
  if (record.source === 'apply') {
    const after = stack.entries[stack.position - 1]
    if (after && (record.applied ?? 0) > 0) {
      stack.applied = [
        ...stack.applied,
        { after: after.id, count: record.applied!, time: Date.now() },
      ]
      publish(table)
    }
  } else if (record.source === 'undo' || record.source === 'redo') {
    if (stack.own) stack.own(record)
    else settleLate(table, record)
  } else if (
    !recordable(table, {
      source: record.source,
      cells: record.cells,
      ...(record.rows ? { rows: record.rows } : {}),
      ...(record.move ? { move: record.move } : {}),
    })
  ) {
    // Не записанное (§16) — без записи; эхо своей записи остаётся: данные приложения догонят.
    if (record.move)
      stack.moveEcho = {
        rowId: record.move.rowId,
        stale: record.move.from,
        fresh: record.move.to,
      }
    else if (record.cells.length > 0) remember(table, record.cells, 'redo')
  } else if (record.rows && record.rows.length > 0) {
    push(table, {
      id: `history-${++entries}`,
      source: record.source,
      time: Date.now(),
      cells: record.cells,
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

/** Своя запись приложения (§12); возвращает id записи, не записанная (§16) — `undefined`. */
export const pushHistory = (table: unknown, app: AppHistoryEntry) => {
  if (!recordable(table, { source: 'app', cells: [], label: app.label }))
    return undefined
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
 * Выделить ячейки записи и прокрутить к ним (§9); скрытые — объявить. `show` — нажатие на текущую
 * запись (§11): область по центру и вспышка, как у «Показать» журнала отказов и пульта; иначе область
 * копится для вспышки в конце перехода.
 */
const reveal = (
  table: unknown,
  cells: readonly WrittenCell[],
  indexes?: ReadonlyMap<string, number>,
  show = false,
  /** Шаг записан черновиками — без вспышки сохранения. */
  draft = false,
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
  const target: HighlightTarget =
    top === bottom && left === right
      ? { cell: [top.id, left.id] }
      : {
          range: {
            anchorRowId: top.id,
            anchorColumnId: left.id,
            focusRowId: bottom.id,
            focusColumnId: right.id,
          },
        }
  if (show) flashOutcome(table, target, 'arrived')
  // Переход к записи: черновики вспышки сохранения не дают — их область вспыхнет в конце (§11).
  else if (draft) stackOf(table).changed?.push(target)
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
): Promise<CellsWritten | 'none' | 'limited'> => {
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
    // Отказ предела (ADR 0223, §4) уже показан плашкой — шаг просто не сделан.
    if (report?.limited) return 'limited'
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
  if (result === 'limited') return false
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
  if (reveal(table, done, entry.indexes, false, !!result.draft))
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
  /** Запись со строками и ячейками: шаг делает часть ячеек. */
  advance = true,
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
  if (!advance) return true
  const stack = stackOf(table)
  stack.position += direction === 'undo' ? -1 : 1
  publish(table)
  void scrollToRow(table as never, entry.rows![0]!.rowId)
  stack.changed?.push(...entry.rows!.map(row => ({ row: row.rowId })))
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
      : entry.rows && entry.cells.length > 0
        ? (stepRows(table, entry, direction, notes, false),
          await stepCells(table, entry, index, direction, notes))
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
  // Переход к записи (§11): изменённое за переход вспыхивает в конце; уже на месте — показать её.
  stack.changed = []
  let moved = false
  try {
    if (entryId === null) {
      while (stack.position > 0) {
        moved = true
        if (!(await step(table, 'undo', source))) return false
      }
      return true
    }
    for (;;) {
      const index = stack.entries.findIndex(entry => entry.id === entryId)
      if (index < 0) return false
      if (index < stack.position - 1) {
        moved = true
        if (!(await step(table, 'undo', source))) return false
      } else if (index >= stack.position) {
        moved = true
        if (!(await step(table, 'redo', source))) return false
      } else {
        if (!moved) showEntry(table, entryId)
        return true
      }
    }
  } finally {
    const changed = stack.changed
    stack.changed = undefined
    if (changed.length > 0) flashOutcome(table, changed, 'arrived')
  }
}

/** «Стоп» ждущего шага: своя запись ячеек и запись приложения. */
export const cancelStep = (table: unknown) => {
  cancelPending(table, { kind: 'history' })
  if (stackOf(table).own) cancelPending(table, { kind: 'cellEdit' })
}

/** Показать ячейки записи без отката — нажатие на текущую запись (§11). */
export const showEntry = (table: unknown, entryId: string) => {
  const entry = stackOf(table).entries.find(item => item.id === entryId)
  if (
    entry &&
    entry.cells.length > 0 &&
    reveal(table, entry.cells, entry.indexes, true)
  )
    announceLabel(table, all => editHistoryLabels(all).announceHidden)
}
