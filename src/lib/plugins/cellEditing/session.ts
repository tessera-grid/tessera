/**
 * Сессия правки ячейки (ADR 0040, §2): начало, черновик, завершение и
 * согласование с таблицей. Сессию ведёт плагин, а не смонтированный редактор —
 * она переживает прокрутку, смену страницы, сортировку и скрытие колонки.
 * Сохранение с промисом отделяет ячейку от активной правки в `submitted`
 * (ADR 0041, §2): правка других ячеек не ждёт сервера.
 */
import { batch } from '@tanstack/react-store'

import { announceLabel, announcerLabels } from '../../core/announcer'
import type { PluginReconcileContext } from '../../core/features'
import { ENGLISH_LABELS } from '../../core/localization'
import {
  type DebugActionSource,
  reportAction,
  reportOutcome,
  sourceOf,
} from '../../core/debugActions'
import {
  type CancelSource,
  cellPendingId,
  hasPending,
  lateAnswer,
  registerPending,
} from '../../core/cancellation'
import type { RowSource } from '../../core/rowSource'
import { inferDataType, setAtPath } from './columnDataType'
import { isNumericBase } from '../../core/dataTypeFormat'
import { inOneCommit } from '../../util/oneCommit'
import { logWarn } from '../../util/logger'
import { isThenable, rejectionText } from '../../util/thenable'
import { markOwnWrites, settleOwnOn } from '../../shared/ownWrites'
import {
  pluginStateKey,
  readPluginHooks,
  setPluginState,
} from '../../core/definePlugin'
import type { CellComponentProps } from '../../core/createSlots'
import { flashOutcome } from '../../core/flashes/flashFeature'
import { useSliceProjection } from '../../core/reactivity'
import type { FlashTarget } from '../../core/highlights/highlightFeature'
import {
  type FailureBulk,
  type FailureReport,
  cellFailureKey,
  failureKeyOf,
  readFailures,
  reportFailures,
  resolveFailure,
  resolveFailures,
  whenBatchResolved,
  whenFailureGone,
} from '../../core/failures/failuresFeature'
import {
  type ActionStatus,
  type ActionStatusEntry,
  closeTableNotice,
  showTableNotice,
  type TableNotice,
  writeActionStatus,
} from '../../core/headerActions/actionStatusFeature'
import { columnOf, editTextOf, parseEditText, sameEditValue } from './editValue'
import {
  type Draft,
  draftKeyOf,
  draftKindOf,
  draftOf,
  readDrafts,
  removeDraft,
  removeDrafts,
  setDraft as putDraft,
  writeDrafts,
} from '../../core/drafts/drafts'
import {
  type CellWriteSource,
  DEFAULT_WRITE_LIMITS,
  notifyCellsWritten,
  type WrittenCell,
} from '../../core/cellWrites'
import type { TableLabels } from '../../core/localization'
import { commonOptionsOf } from '../../core/commonFeature'
import {
  ROW_DELETE_DRAFT,
  ROW_INSERT_DRAFT,
  type RowInsertValue,
  baseIndexOfNewRow,
  isDeletedRow,
  isNewRow,
  writeNewRowValues,
} from './rowDrafts'
import type {
  ApplyOutcome,
  CellEditBatchResult,
  RowInsertBatchItem,
  CellEditingHooks,
  CellEditingState,
  EditCancelReason,
  EditingCell,
  EditSession,
  SubmittedCell,
} from './types'
import { cellEditingLabels } from './labels'
import { actionLabelOf } from '../../core/actions'
import { objectTargetText } from '../../shared/objectTarget'

const ID = 'cellEditing'
export const EDIT_SESSION_KEY = pluginStateKey(ID)

export const DEFAULT_CAN_EDIT_CELL = () => true

export const EMPTY_EDITING_STATE: CellEditingState = {
  active: null,
  submitted: {},
}

interface SessionRow {
  id: string
  original?: unknown
  getValue: (columnId: string) => unknown
}

type SessionTable = {
  atoms: Record<string, { get: () => unknown } | undefined>
}

type Cell = { rowId: string; columnId: string }

const KEY_SEPARATOR = '\u0000'

/** Конец сессии правки — жест в канале действий (ADR 0125, AL19). */
export const reportEditEnd = (
  table: unknown,
  cell: { rowId: string; columnId: string },
  detail: Record<string, unknown>,
  reason?: string,
) =>
  reportAction(table, {
    plugin: ID,
    action: 'edit',
    detail: { ...cell, ...detail },
    // Без пользователя — запрет, уход ячейки, конфликт; иначе — событие, которое
    // закрыло правку: Enter или Escape (`keydown`), уход фокуса (`blur`).
    source:
      reason === 'revoke' || reason === 'unavailable' || reason === 'conflict'
        ? 'auto'
        : sourceOf(globalThis.event),
    phase: 'end',
  })

export const cellKey = (rowId: string, columnId: string) =>
  `${rowId}${KEY_SEPARATOR}${columnId}`

export const readEditingState = (table: unknown): CellEditingState =>
  ((table as SessionTable).atoms[EDIT_SESSION_KEY]?.get() as
    CellEditingState | undefined) ?? EMPTY_EDITING_STATE

/** Отказы, которые пишутся в реестр вместе с отказами отправленных ячеек — одной записью. */
interface FailureChanges {
  reports?: readonly FailureReport[]
  resolve?: readonly string[]
}

const writeEditingState = (
  table: unknown,
  next: CellEditingState,
  failures?: FailureChanges,
) => {
  const prev = readEditingState(table).submitted
  setPluginState(table, ID, next)
  syncSubmitted(table, prev, next.submitted, failures)
}

const pendingKey = (key: string) => `cellEdit:${key}`

const sameAttempt = (a: SubmittedCell | undefined, b: SubmittedCell) =>
  a?.status === b.status && a.attempt === b.attempt

/** Отправленные ячейки, уже переданные срезам ядра, — по store таблицы. */
const synced = new WeakMap<object, Record<string, SubmittedCell>>()

/**
 * Срез, заданный приложением (ADR 0028, CE6), минует запись плагина: после рендера он
 * передаётся срезам ядра так же.
 */
const syncAppSubmitted = (table: unknown) => {
  const { submitted } = readEditingState(table)
  const last =
    synced.get((table as { store: object }).store) ??
    EMPTY_EDITING_STATE.submitted
  if (last !== submitted) syncSubmitted(table, last, submitted)
}

/**
 * Отправленные ячейки — в общих срезах ядра (ADR 0177, §1, §5): ожидание — волна ячейки
 * (у булева — его флажок, ADR 0176), отказ — запись реестра отказов с повтором и «Сбросить»;
 * по ней ячейка рисует треугольник.
 */
const syncSubmitted = (
  table: unknown,
  prev: Record<string, SubmittedCell>,
  next: Record<string, SubmittedCell>,
  failures?: FailureChanges,
) => {
  synced.set((table as { store: object }).store, next)
  if (prev === next) {
    if (failures)
      reportFailures(table, failures.reports ?? [], failures.resolve)
    return
  }
  const pendingGone: string[] = []
  const pendingNew: SubmittedCell[] = []
  const resolved: string[] = [...(failures?.resolve ?? [])]
  const reports: FailureReport[] = []
  for (const [key, entry] of Object.entries(prev)) {
    const now = next[key]
    if (now && sameAttempt(entry, now)) continue
    if (entry.status === 'pending') pendingGone.push(key)
    if (entry.status === 'error' && now?.status !== 'error')
      resolved.push(cellFailureKey(entry.rowId, entry.columnId))
  }
  for (const [key, entry] of Object.entries(next)) {
    if (sameAttempt(prev[key], entry)) continue
    if (entry.status === 'pending') pendingNew.push(entry)
    if (entry.status === 'error')
      reports.push(cellFailureReport(table, key, entry))
  }
  // Отказы одного ответа — одной записью в реестр (ADR 0227, AO5).
  reportFailures(table, [...reports, ...(failures?.reports ?? [])], resolved)
  if (pendingGone.length === 0 && pendingNew.length === 0) return
  writeActionStatus(table, status => {
    const out: ActionStatus = { ...status }
    for (const key of pendingGone) delete out[pendingKey(key)]
    for (const entry of pendingNew) {
      const boolean =
        columnOf(table, entry.columnId)?.getDataType()?.base === 'boolean'
      out[pendingKey(cellKey(entry.rowId, entry.columnId))] = {
        pending: true,
        target: [{ cell: [entry.rowId, entry.columnId] }],
        ...(boolean ? {} : { wave: true }),
      }
    }
    return out
  })
}

/** Подпись записи — действие «Правка»: колонку и строку называет цель (ADR 0177, §7). */
/** Правка ячейки в справочнике действий (ADR 0182). */
const EDIT_ACTION = { plugin: 'cellEditing', action: 'edit' }

/** Запись реестра об отказе ячейки: за ней стоит правка — `discard`. */
const cellFailureReport = (
  table: unknown,
  key: string,
  entry: SubmittedCell,
): FailureReport => {
  const labels = announcerLabels(table) ?? ENGLISH_LABELS
  return {
    action: EDIT_ACTION,
    target: { cell: [entry.rowId, entry.columnId] },
    reason: entry.error ?? labels.saveFailed,
    retry: () => retrySubmitted(table, key),
    discard: () => discardSubmitted(table, key),
    ...(entry.batch ? { batch: entry.batch } : {}),
    // Повтор набором — правки применения: у них есть черновики (ADR 0227, AO8).
    bulk: bulkOf(table, !!entry.batch?.startsWith(APPLY_BATCH)),
  }
}

/** Действия набора отказов правок одним вызовом: журнал зовёт их с ключами записей. */
const bulkOf = (table: unknown, retry: boolean): FailureBulk => ({
  owner: ID,
  discard: keys => discardFailedEdits(table, keys),
  ...(retry
    ? { retry: (keys: readonly string[]) => retryFailedEdits(table, keys) }
    : {}),
})

/** Повтор отклонённого сохранения из поповера отметки (ADR 0177, §5). */
const retrySubmitted = (table: unknown, key: string) => {
  const entry = readEditingState(table).submitted[key]
  if (!entry || entry.status !== 'error') return
  const hooks = readPluginHooks<Partial<CellEditingHooks>>(table as never, ID)
  const draft = manual(hooks)
    ? cellDraftOf(table, entry.rowId, entry.columnId)
    : undefined
  if (draft) {
    commitDrafts(table, [draft])
    return
  }
  submitValue(table, entry, entry.draft, entry.text, entry.original, hooks, {
    onSettled: outcome =>
      outcome === true &&
      notifyEdit(table, entry, entry.original, entry.draft, outcome),
  })
}

/**
 * «Сбросить изменение»: отклонённое значение удаляется, черновик уходит в `onEditCancel`.
 * Черновик сбрасывается тем же путём, что из пульта: запись истории (ADR 0227, AO13).
 */
const discardSubmitted = (table: unknown, key: string) => {
  const entry = readEditingState(table).submitted[key]
  if (!entry || entry.status !== 'error') return
  discardFailedEdits(table, [{ rowId: entry.rowId, columnId: entry.columnId }])
}

/** Отказ из реестра — по его ключу — или цель правки: ячейка или, без `columnId`, строка. */
export type FailedEditRef = string | { rowId: string; columnId?: string }

const refTargets = (table: unknown, refs: readonly FailedEditRef[]) => {
  const failures = readFailures(table)
  const cells = new Set<string>()
  const rows = new Set<string>()
  for (const ref of refs) {
    const target =
      typeof ref === 'string'
        ? failures[ref]?.target
        : ref.columnId === undefined
          ? { row: ref.rowId }
          : { cell: [ref.rowId, ref.columnId] as [string, string] }
    if (!target) continue
    if ('cell' in target) cells.add(cellKey(...target.cell))
    else if ('row' in target) rows.add(target.row)
  }
  return { cells, rows }
}

/** Черновики правок по целям: ячейки и строки до сохранения. */
const draftsAt = (
  table: unknown,
  { cells, rows }: { cells: ReadonlySet<string>; rows: ReadonlySet<string> },
) =>
  readDrafts(table).filter(draft =>
    draft.kind === CELL_VALUE_DRAFT && 'cell' in draft.target
      ? cells.has(cellKey(...draft.target.cell))
      : isRowDraft(draft) && rows.has((draft.target as { row: string }).row),
  )

/**
 * Повторить правки набора отказов одним вызовом `onCommitEdits` (ADR 0227, §4, AO8): черновики
 * ячеек и строк этих отказов — одним пакетом.
 */
export const retryFailedEdits = (
  table: unknown,
  refs: readonly FailedEditRef[],
) => {
  const drafts = draftsAt(table, refTargets(table, refs))
  if (drafts.length > 0) commitDrafts(table, drafts)
}

/**
 * Сбросить правки набора отказов (ADR 0227, §4, AO8): черновики — одной записью в срез
 * черновиков, отказы — одной записью в реестр; сбрасывание — запись истории, как из пульта
 * (ADR 0222, §14); черновики ячеек — в `onEditCancel`.
 */
export const discardFailedEdits = (
  table: unknown,
  refs: readonly FailedEditRef[],
) => {
  const targets = refTargets(table, refs)
  const drafts = draftsAt(table, targets)
  for (const draft of drafts)
    draftKindOf(table, draft.kind)?.discard?.(table, draft)
  const chosen = new Set(drafts)
  removeDrafts(table, draft => chosen.has(draft))
  const state = readEditingState(table)
  const dropped: SubmittedCell[] = []
  const submitted = { ...state.submitted }
  for (const key of targets.cells) {
    const entry = submitted[key]
    if (entry?.status !== 'error') continue
    dropped.push(entry)
    delete submitted[key]
  }
  const active =
    state.active &&
    targets.cells.has(
      cellKey(state.active.cell.rowId, state.active.cell.columnId),
    )
      ? null
      : state.active
  const resolve = [...targets.rows].map(row => failureKeyOf({ row }))
  if (dropped.length > 0 || active !== state.active)
    writeEditingState(table, { ...state, active, submitted }, { resolve })
  else resolveFailures(table, resolve)
  const { onEditCancel } = readPluginHooks<Partial<CellEditingHooks>>(
    table as never,
    ID,
  )
  for (const entry of dropped)
    onEditCancel?.({
      rowId: entry.rowId,
      columnId: entry.columnId,
      reason: 'cancel',
      draft: entry.draft,
      text: entry.text,
      original: entry.original,
      ...(entry.error ? { error: entry.error } : {}),
    })
}

/** Вид черновика значения ячейки в режиме сохранения по кнопке (ADR 0178, §5). */
export const CELL_VALUE_DRAFT = 'cellValue'

/** Значение черновика ячейки: в типе колонки и набранный текст. */
export interface CellDraftValue {
  value: unknown
  text: string
}

/** Черновик значения ячейки или `undefined`. */
export const cellDraftOf = (
  table: unknown,
  rowId: string,
  columnId: string,
): Draft | undefined =>
  draftOf(table, CELL_VALUE_DRAFT, { cell: [rowId, columnId] })

const dataValueOf = (table: unknown, rowId: string, columnId: string) =>
  (table as ReconcileTable).getRowSource().byId(rowId)?.getValue(columnId)

/** Значение, которое ячейка показывает: черновик, иначе данные (ADR 0222, §8). */
export const shownValueOf = (
  table: unknown,
  rowId: string,
  columnId: string,
  row?: Pick<SessionRow, 'getValue'>,
) => {
  const draft = cellDraftOf(table, rowId, columnId)
  if (draft) return (draft.value as CellDraftValue).value
  return row ? row.getValue(columnId) : dataValueOf(table, rowId, columnId)
}

let edits = 0

/** Итог одиночной правки — каналу истории (ADR 0222, §2). */
const notifyEdit = (
  table: unknown,
  { rowId, columnId }: Cell,
  before: unknown,
  after: unknown,
  outcome: boolean | 'cancelled' | 'draft',
) =>
  notifyCellsWritten(table, {
    id: `edit-${++edits}`,
    source: 'edit',
    cells:
      outcome === false || outcome === 'cancelled'
        ? []
        : [{ rowId, columnId, before, after }],
    refused: outcome === false ? [{ rowId, columnId }] : [],
    ...(outcome === 'draft' ? { draft: true } : {}),
    ...(outcome === 'cancelled' ? { cancelled: true } : {}),
  })

/** Записать черновик ячейки; совпал со значением в данных — снять. */
const storeCellDraft = (
  table: unknown,
  { rowId, columnId }: Cell,
  value: unknown,
  text: string,
) => {
  if (isNewRow(table, rowId)) {
    const key = (table as SavedTable).getColumn?.(columnId)?.columnDef
      .accessorKey
    if (typeof key !== 'string') {
      warnNotWritten(table)
      return
    }
    writeNewRowValues(
      table,
      rowId,
      values => setAtPath(values, key, value) as Record<string, unknown>,
    )
    return
  }
  if (
    sameEditValue(table, columnId, value, dataValueOf(table, rowId, columnId))
  ) {
    removeDraft(table, CELL_VALUE_DRAFT, { cell: [rowId, columnId] })
    return
  }
  const draft: CellDraftValue = { value, text }
  putDraft(table, {
    kind: CELL_VALUE_DRAFT,
    target: { cell: [rowId, columnId] },
    value: draft,
  })
}

const manual = (hooks: Partial<CellEditingHooks>) => hooks.saveMode === 'manual'

export const readEditSession = (table: unknown): EditingCell =>
  readEditingState(table).active

export const isEditingCell = (
  session: EditingCell,
  rowId: string,
  columnId: string,
) => session?.cell.rowId === rowId && session.cell.columnId === columnId

/** Ячейка в ждущем пакете операции записи или `undefined`. */
const packagedCell = (
  state: CellEditingState,
  key: string,
): SubmittedCell | undefined => {
  if (!state.packages) return undefined
  for (const pending of Object.values(state.packages)) {
    const cell = pending.cells.get(key)
    if (cell) return cell
  }
  return undefined
}

/**
 * Что показывает ячейка: `'editing'` — редактор, отправленная ячейка — её
 * ожидание или ошибку, `null` — собственный контент.
 */
export const cellEditingViewOf = (
  state: CellEditingState | undefined,
  rowId: string,
  columnId: string,
): 'editing' | SubmittedCell | null => {
  if (!state) {
    return null
  }
  if (isEditingCell(state.active, rowId, columnId)) {
    return 'editing'
  }
  const key = cellKey(rowId, columnId)
  return state.submitted[key] ?? packagedCell(state, key) ?? null
}

/** Сохранение этой ячейки ещё ждёт сервера — повторной правки нет. */
export const isCellPending = (
  table: unknown,
  rowId: string,
  columnId: string,
) => {
  const state = readEditingState(table)
  const key = cellKey(rowId, columnId)
  return (
    state.submitted[key]?.status === 'pending' ||
    hasPending(table, { kind: 'cellEdit', id: key })
  )
}

/**
 * Открыть правку ячейки. Открытая сессия другой ячейки (недопустимое значение,
 * оставшееся после потери фокуса) завершается `cancel` — черновик не пропадает молча.
 * Ячейку, ждущую сервера, не открыть.
 */
export const startEditSession = (
  table: unknown,
  row: SessionRow,
  column: { id: string },
  source: DebugActionSource = 'api',
) => {
  // Ячейки удалённой строки не правятся (DR28).
  if (isCellPending(table, row.id, column.id) || isDeletedRow(table, row.id)) {
    return
  }
  const open = readEditSession(table)
  if (open && !isEditingCell(open, row.id, column.id)) {
    cancelEditSession(
      table,
      'cancel',
      readPluginHooks<Partial<CellEditingHooks>>(
        table as { getHooks: () => unknown },
        ID,
      ),
    )
  }
  // Из «ошибки» — с отклонённым черновиком и текстом отказа (ADR 0041, §2); из черновика
  // ячейки — с его значением (ADR 0178, §5).
  const failed = readEditingState(table).submitted[cellKey(row.id, column.id)]
  const saved = cellDraftOf(table, row.id, column.id)?.value as
    CellDraftValue | undefined
  const original = failed ? failed.original : row.getValue(column.id)
  const session: EditSession = {
    cell: { rowId: row.id, columnId: column.id },
    draft: failed ? failed.draft : saved ? saved.value : original,
    text: failed
      ? failed.text
      : saved
        ? saved.text
        : editTextOf(table, column.id, original),
    original,
    ...(failed ? { rejected: { error: failed.error ?? '' } } : {}),
  }
  writeEditingState(table, { ...readEditingState(table), active: session })
  reportAction(table, {
    plugin: ID,
    action: 'edit',
    detail: session.cell,
    source,
    phase: 'start',
  })
}

const writeDraft = (table: unknown, draft: unknown, text: string) => {
  const state = readEditingState(table)
  if (
    state.active &&
    (state.active.text !== text || !Object.is(state.active.draft, draft))
  ) {
    reportAction(table, {
      plugin: ID,
      action: 'changeDraft',
      detail: { draft, text },
      source: 'keyboard',
    })
    writeEditingState(table, {
      ...state,
      active: { ...state.active, draft, text },
    })
  }
}

/** Черновик в типе колонки; текст — его вид в поле. */
export const setEditDraft = (table: unknown, draft: unknown) => {
  const active = readEditSession(table)
  if (active)
    writeDraft(table, draft, editTextOf(table, active.cell.columnId, draft))
}

/** Набранный текст; черновик в типе — его разбор, не разобрался — `undefined`. */
export const setEditText = (table: unknown, text: string) => {
  const active = readEditSession(table)
  if (!active) return
  const parsed = parseEditText(
    table,
    active.cell.columnId,
    text,
    rowValuesOf(table, active),
  )
  writeDraft(table, parsed?.value, text)
}

/** Строка данных и прежнее значение ячейки сессии — для разбора. */
const rowValuesOf = (table: unknown, session: EditSession) => {
  const row = (table as ReconcileTable).getRowSource().byId(session.cell.rowId)
  return {
    original: row?.original,
    current: row ? row.getValue(session.cell.columnId) : session.original,
  }
}

/** Ошибка `validate`: живёт в сессии и переживает размонтирование редактора (SS21). */
export const setEditError = (table: unknown, invalid: string) => {
  const state = readEditingState(table)
  if (state.active && state.active.invalid !== invalid) {
    reportAction(table, {
      plugin: ID,
      action: 'validationFailed',
      detail: { message: invalid },
      source: 'auto',
    })
    writeEditingState(table, {
      ...state,
      active: { ...state.active, invalid },
    })
  }
}

/** Закрыть активную правку; «ошибка» её ячейки снимается — сессия её забрала. */
export const endEditSession = (table: unknown) => {
  const state = readEditingState(table)
  const cell = state.active?.cell
  const key = cell && cellKey(cell.rowId, cell.columnId)
  if (key && state.submitted[key]?.status === 'error') {
    const submitted = { ...state.submitted }
    delete submitted[key]
    writeEditingState(table, { ...state, active: null, submitted })
    return
  }
  writeEditingState(table, { ...state, active: null })
}

/** Завершить сессию без сохранения: черновик уходит в `onEditCancel`. */
export const cancelEditSession = (
  table: unknown,
  reason: EditCancelReason,
  hooks: Partial<CellEditingHooks>,
  current?: { value: unknown },
) => {
  const session = readEditSession(table)
  if (!session) {
    return
  }
  endEditSession(table)
  reportEditEnd(table, session.cell, { result: 'cancel', reason }, reason)
  hooks.onEditCancel?.({
    rowId: session.cell.rowId,
    columnId: session.cell.columnId,
    reason,
    draft: session.draft,
    text: session.text,
    original: session.original,
    ...(current ? { current: current.value } : {}),
    ...(session.rejected ? { error: session.rejected.error } : {}),
  })
}

// Номер отправки сквозной: снятое и заново отправленное сохранение той же ячейки не
// спутать с поздним итогом прежнего.
let lastAttempt = 0

interface SavedTable {
  setRowData?: (id: string, updater: (row: unknown) => unknown) => void
  getColumn?: (
    id: string,
  ) => { columnDef: { accessorKey?: unknown } } | undefined
  options: {
    getRowId?: (row: unknown, index: number) => string
  }
}

/** Ответ `onCellEdit` — сохранённая строка: объект с тем же id (ADR 0139, §1). */
const isSavedRow = (t: SavedTable, rowId: string, answer: unknown) => {
  if (typeof answer !== 'object' || answer === null) return false
  const id = t.options.getRowId
    ? t.options.getRowId(answer, 0)
    : (answer as { id?: unknown }).id
  return id === rowId
}

const warnNotWritten = (table: unknown) =>
  logWarn(
    table as never,
    'cellEditing: the saved value is not written to the server row cache — return the saved row from onCellEdit or give the column an accessorKey',
    'cellEditing:notWritten',
  )

/** Текст в запись `object` разбирает только свой `parseValue` (ADR 0174, TY8). */
const warnObjectNotParsed = (table: unknown) =>
  logWarn(
    table as never,
    'cellEditing: an object column turns the entered text into a record only by its parseValue — set parseValue or an editor on the column or its type',
    'cellEditing:objectNotWritten',
  )

/**
 * Серверная модель строк: данных у приложения нет — итог правки пишется в кэш строк
 * (ADR 0139): строка из ответа `onCellEdit`, без неё — сохранённое значение в типе колонки,
 * без второго разбора (ADR 0175, ED2). Без серверной модели метода `setRowData` нет, данные
 * обновляет приложение.
 */
const writeSaved = (
  table: unknown,
  rowId: string,
  columnId: string,
  value: unknown,
  answer: unknown,
) => {
  const t = table as SavedTable
  if (!t.setRowData) return
  if (isSavedRow(t, rowId, answer)) {
    t.setRowData(rowId, () => answer)
    return
  }
  const key = t.getColumn?.(columnId)?.columnDef.accessorKey
  if (typeof key !== 'string') {
    warnNotWritten(table)
    return
  }
  t.setRowData(rowId, data => setAtPath(data, key, value))
}

/** Сохранённые значения ячеек строки — одной записью в кэш строк (серверная модель). */
const writeSavedRow = (
  table: unknown,
  rowId: string,
  values: readonly { columnId: string; value: unknown }[],
) => {
  const t = table as SavedTable
  if (!t.setRowData) return
  const paths = values.flatMap(({ columnId, value }) => {
    const key = t.getColumn?.(columnId)?.columnDef.accessorKey
    if (typeof key === 'string') return [{ key, value }]
    warnNotWritten(table)
    return []
  })
  if (paths.length === 0) return
  t.setRowData(rowId, data =>
    paths.reduce((row, { key, value }) => setAtPath(row, key, value), data),
  )
}

const settleSubmitted = (
  table: unknown,
  key: string,
  attempt: number,
  outcome: { ok: true; answer: unknown } | { ok: false; reason: unknown },
) => {
  const state = readEditingState(table)
  const entry = state.submitted[key]
  if (!entry || entry.attempt !== attempt || entry.status !== 'pending') {
    return
  }
  const submitted = { ...state.submitted }
  if (outcome.ok) {
    writeSaved(table, entry.rowId, entry.columnId, entry.draft, outcome.answer)
    delete submitted[key]
    writeEditingState(table, { ...state, submitted })
    flashOutcome(table, { cell: [entry.rowId, entry.columnId] }, 'accepted')
    return
  }
  const labels = announcerLabels(table) ?? ENGLISH_LABELS
  const error = rejectionText(outcome.reason) ?? labels.saveFailed
  submitted[key] = { ...entry, status: 'error', error }
  writeEditingState(table, { ...state, submitted })
  // Значение в ячейке вернулось к данным — в том же кадре, что отказ на кнопке правки.
  flashOutcome(table, { cell: [entry.rowId, entry.columnId] }, 'reverted')
  announceLabel(table, all =>
    cellEditingLabels(all).announceSaveFailed(
      actionLabelOf(table, EDIT_ACTION, all),
      objectTargetText(table, { cell: [entry.rowId, entry.columnId] }, all),
      error,
    ),
  )
}

export const columnNameOf = (table: unknown, columnId: string) => {
  const header = (table as ReconcileTable)
    .getAllLeafColumns()
    .find(column => column.id === columnId)?.columnDef?.header
  return typeof header === 'string' ? header : columnId
}

/** Что сохраняет редактор: значение в типе колонки или набранный текст для разбора. */
export type EditInput = { value: unknown; text?: string } | { text: string }

const contextOf = (table: unknown, { rowId, columnId }: Cell) =>
  (table as ReconcileTable)
    .getRowSource()
    .byId(rowId)
    ?.getAllCells()
    .find(item => item.column.id === columnId)
    ?.getContext() as CellComponentProps | undefined

/**
 * Сохранить правку (ADR 0175, §1): набранный текст разбирается по типу колонки — не
 * разобрался — ошибка поля без сохранения; значение не изменилось — правка закрывается без
 * `onCellEdit` (SS18); `validate` — со значением в типе и текстом; затем коммит.
 */
export const saveEdit = (
  table: unknown,
  cell: Cell,
  input: EditInput,
  hooks: Partial<CellEditingHooks>,
  ctx = contextOf(table, cell),
) => {
  const session = readEditSession(table)
  if (!isEditingCell(session, cell.rowId, cell.columnId)) {
    return
  }
  let value: unknown
  let text: string
  if ('value' in input) {
    value = input.value
    text = input.text ?? editTextOf(table, cell.columnId, value)
    writeDraft(table, value, text)
  } else {
    text = input.text
    const values = rowValuesOf(table, session!)
    const parsed = parseEditText(table, cell.columnId, text, values)
    if (text !== session!.text) writeDraft(table, parsed?.value, text)
    if (!parsed) {
      const base =
        columnOf(table, cell.columnId)?.getDataType()?.base ??
        inferDataType(values.current)
      if (base === 'object') warnObjectNotParsed(table)
      const labels = announcerLabels(table) ?? ENGLISH_LABELS
      setEditError(
        table,
        isNumericBase(base)
          ? cellEditingLabels(labels).editInvalidNumber
          : cellEditingLabels(labels).editInvalidValue,
      )
      return
    }
    value = parsed.value
  }
  if (sameEditValue(table, cell.columnId, value, session!.original)) {
    if (manual(hooks))
      removeDraft(table, CELL_VALUE_DRAFT, {
        cell: [cell.rowId, cell.columnId],
      })
    reportAction(table, {
      plugin: ID,
      action: 'edit',
      detail: { ...session!.cell, result: 'unchanged' },
      source: sourceOf(globalThis.event),
      phase: 'end',
    })
    endEditSession(table)
    return
  }
  const message = ctx && hooks.validate?.(value, ctx, text)
  if (message) {
    setEditError(table, message)
    return
  }
  commitEditSession(table, cell, value, hooks, text)
}

/**
 * Отклонение из-за изменения извне — как отказ сервера (ADR 0175, ED22): «ошибка» ячейки с
 * черновиком и причиной, вспышка отката, объявление. Повторная правка начинается от значения,
 * пришедшего извне.
 */
const refuseOnConflict = (
  table: unknown,
  { rowId, columnId }: Cell,
  value: unknown,
  text: string,
  now: unknown,
) => {
  const labels = announcerLabels(table) ?? ENGLISH_LABELS
  const error = cellEditingLabels(labels).editConflict
  const state = readEditingState(table)
  writeEditingState(table, {
    ...state,
    submitted: {
      ...state.submitted,
      [cellKey(rowId, columnId)]: {
        rowId,
        columnId,
        draft: value,
        text,
        original: now,
        status: 'error',
        error,
        attempt: ++lastAttempt,
      },
    },
  })
  flashOutcome(table, { cell: [rowId, columnId] }, 'reverted')
  announceLabel(table, all =>
    cellEditingLabels(all).announceSaveFailed(
      actionLabelOf(table, EDIT_ACTION, all),
      objectTargetText(table, { cell: [rowId, columnId] }, all),
      error,
    ),
  )
}

/**
 * Сохранить значение сессии этой ячейки (ADR 0040, §3–§4). Сессии нет — уже
 * завершена (Enter, Escape) и потеря фокуса после неё ничего не делает. Значение
 * изменилось извне: по умолчанию сохранение проходит с `original`/`current`, при
 * `onConflict: 'block'` — завершение с `conflict`. Промис от `onCellEdit` отделяет
 * ячейку в ожидание (ADR 0041, §2).
 */
export const commitEditSession = (
  table: unknown,
  cell: Cell,
  value: unknown,
  hooks: Partial<CellEditingHooks>,
  text = editTextOf(table, cell.columnId, value),
) => {
  const session = readEditSession(table)
  if (!isEditingCell(session, cell.rowId, cell.columnId)) {
    return
  }
  const { rowId, columnId } = cell
  const { original } = session!
  const row = (table as ReconcileTable).getRowSource().byId(rowId)
  const now = row ? row.getValue(columnId) : original
  const changed = !Object.is(now, original)
  if (changed && hooks.onConflict === 'block') {
    writeDraft(table, value, text)
    cancelEditSession(table, 'conflict', hooks, { value: now })
    refuseOnConflict(table, cell, value, text, now)
    return
  }
  if (manual(hooks)) {
    reportEditEnd(table, cell, { result: 'draft', value })
    const before = shownValueOf(table, rowId, columnId)
    storeCellDraft(table, cell, value, text)
    endEditSession(table)
    notifyEdit(table, cell, before, value, 'draft')
    return
  }
  reportEditEnd(table, cell, { result: 'commit', value })
  submitValue(table, cell, value, text, original, hooks, {
    session: true,
    ...(changed ? { current: now } : {}),
    onSettled: outcome => notifyEdit(table, cell, now, value, outcome),
  })
}

/**
 * Отправить значение в `onCellEdit`: закрытием правки (`session`) или повтором отказа — тогда
 * открытая правка другой ячейки остаётся.
 */
const submitValue = (
  table: unknown,
  { rowId, columnId }: Cell,
  value: unknown,
  text: string,
  original: unknown,
  hooks: Partial<CellEditingHooks>,
  {
    session = false,
    current,
    onSettled,
    batch,
  }: {
    session?: boolean
    current?: unknown
    /** Операция записи: её `id` несёт отказ (ADR 0227, AO21). */
    batch?: string
    /** Итог сохранения: сохранено, отклонено или прервано «стопом». */
    onSettled?: (outcome: boolean | 'cancelled') => void
  } = {},
) => {
  const controller = new AbortController()
  // Эхо записи в данных — своё, не смена извне (ADR 0221, §1).
  const settleOwn = markOwnWrites(table, [{ rowId, columnId }])
  const result = hooks.onCellEdit?.(
    {
      rowId,
      columnId,
      value,
      text,
      original,
      ...(current !== undefined ? { current } : {}),
    },
    { signal: controller.signal },
  )
  reportOutcome(table, { plugin: ID, action: 'save' }, result)
  const key = cellKey(rowId, columnId)
  if (!isThenable(result)) {
    writeSaved(table, rowId, columnId, value, result)
    settleOwn()
    if (session) {
      endEditSession(table)
      onSettled?.(true)
      return
    }
    const state = readEditingState(table)
    const submitted = { ...state.submitted }
    delete submitted[key]
    writeEditingState(table, { ...state, submitted })
    flashOutcome(table, { cell: [rowId, columnId] }, 'accepted')
    onSettled?.(true)
    return
  }
  const state = readEditingState(table)
  const attempt = ++lastAttempt
  writeEditingState(table, {
    ...state,
    active: session ? null : state.active,
    submitted: {
      ...state.submitted,
      [key]: {
        rowId,
        columnId,
        draft: value,
        text,
        original,
        status: 'pending',
        attempt,
        ...(batch ? { batch } : {}),
      },
    },
  })
  // «Отменить сохранение» в меню ячейки (ADR 0177, §8).
  const unregister = registerPending(table, {
    kind: 'cellEdit',
    id: cellPendingId(rowId, columnId),
    cancel: source => {
      if (controller.signal.aborted) return
      controller.abort()
      unregister()
      cancelSubmitted(table, key, attempt, source, hooks)
      onSettled?.('cancelled')
    },
  })
  result.then(settleOwn, settleOwn)
  result.then(
    answer => {
      if (controller.signal.aborted) return lateAnswer(table)
      unregister()
      settleSubmitted(table, key, attempt, { ok: true, answer })
      onSettled?.(true)
    },
    reason => {
      if (controller.signal.aborted) return lateAnswer(table, reason)
      unregister()
      settleSubmitted(table, key, attempt, { ok: false, reason })
      onSettled?.(false)
    },
  )
}

/**
 * Черновики строк в полёте по ключу: повторное «Применить всё» их не шлёт (ADR 0178, §5, DR54).
 * Ключ — `store`: кнопка пульта нового рендера держит другой объект таблицы.
 */
const rowsInFlight = new WeakMap<object, Set<string>>()
const inFlightOf = (table: unknown) => {
  const { store } = table as { store: object }
  let keys = rowsInFlight.get(store)
  if (!keys) {
    keys = new Set()
    rowsInFlight.set(store, keys)
  }
  return keys
}

const rowKeyOf = (draft: Draft) =>
  `${draft.kind}\u0000${(draft.target as { row: string }).row}`

const isRowDraft = (draft: Draft) =>
  (draft.kind === ROW_INSERT_DRAFT || draft.kind === ROW_DELETE_DRAFT) &&
  'row' in draft.target

/**
 * Сохранённая новая строка — под тем же id, что выдала ей таблица (ADR 0181, NI4): другой id для
 * таблицы — другая строка; в разработке — предупреждение. Строка без id — не та же.
 */
const keepsRowId = (table: unknown, rowId: string, row: unknown) => {
  const id = (
    table as {
      options: { getRowId?: (row: unknown, index: number) => unknown }
    }
  ).options.getRowId?.(row, 0)
  if (id === rowId) return true
  if (id === undefined) return false
  logWarn(
    table as never,
    `cellEditing: the saved new row came back with id "${String(id)}" instead of "${rowId}" — keep the id the table gave the new row: with another id it is another row to the table`,
    `cellEditing:savedRowId:${rowId}`,
  )
  return false
}

/**
 * Черновики новых строк серверной модели снимаются, когда их строка легла в кэш: транзакция —
 * после кадра (ADR 0157), а строка не должна пропасть между ответом и записью (ADR 0181, NI3).
 */
const removeWhenCached = (table: unknown, ids: readonly string[]) => {
  if (ids.length === 0) return
  const t = table as {
    store: { subscribe: (listener: () => void) => { unsubscribe: () => void } }
    getRowSource: () => RowSource<{ id: string }>
  }
  let left = [...ids]
  const check = () => {
    const source = t.getRowSource()
    const base = source.base ?? source
    const arrived = left.filter(id => base.byId(id))
    if (arrived.length === 0) return
    left = left.filter(id => !arrived.includes(id))
    removeDrafts(
      table,
      draft =>
        draft.kind === ROW_INSERT_DRAFT &&
        'row' in draft.target &&
        arrived.includes(draft.target.row),
    )
    if (left.length === 0) subscription.unsubscribe()
  }
  const subscription = t.store.subscribe(check)
}

/**
 * Черновик сохранённой новой строки клиентского режима снимается задачей после ответа: запись
 * `data` приложением на React 18 идёт отдельным коммитом после снятия, и строка пропала бы на
 * один коммит (ADR 0181, NI5). Пока оба есть, слой новую строку не рисует (NI2).
 */
const removeAfterAppData = (table: unknown, ids: readonly string[]) => {
  if (ids.length === 0) return
  setTimeout(() => {
    removeDrafts(
      table,
      draft =>
        draft.kind === ROW_INSERT_DRAFT &&
        'row' in draft.target &&
        ids.includes(draft.target.row),
    )
  })
}

const isServerRows = (table: unknown) =>
  typeof commonOptionsOf(table).getRowSource === 'function'

type TransactionTable = {
  applyRowTransaction?: (transaction: {
    add?: unknown[]
    index?: number
    remove?: string[]
  }) => unknown
  getRowId?: (row: unknown, index: number) => string
}

const committing = new WeakSet<object>()

/** Префикс id применения черновиков — `batch` его отказов (ADR 0227, §3). */
const APPLY_BATCH = 'apply-'

/** Все черновики пакета: открытая правка, ячейки и строки (ADR 0178, §7). */
export const commitAllDrafts = (table: unknown) => {
  // «Применить всё» зовёт каждый вид пакета: пакет уходит один раз за проход.
  if (committing.has(table as object)) return
  committing.add(table as object)
  queueMicrotask(() => committing.delete(table as object))
  const session = readEditSession(table)
  if (session)
    saveEdit(
      table,
      session.cell,
      { value: session.draft, text: session.text },
      readPluginHooks<Partial<CellEditingHooks>>(table as never, ID),
    )
  commitDrafts(
    table,
    readDrafts(table).filter(
      draft => draft.kind === CELL_VALUE_DRAFT || isRowDraft(draft),
    ),
  )
}

/**
 * Сохранить черновики пакетом (ADR 0178, §5, §7; DR17, DR30): один вызов `onCommitEdits` —
 * правки ячеек, новые и удалённые строки; пока промис не решён, ячейки пакета ждут
 * (ожидание на объекте); сохранённое снимает черновик и пишется в кэш серверной модели,
 * отказанное — отказ на объекте, черновик остаётся.
 */
export const commitDrafts = (table: unknown, drafts: readonly Draft[]) => {
  const hooks = readPluginHooks<Partial<CellEditingHooks>>(table as never, ID)
  const inFlight = readEditingState(table).submitted
  const rowsFlying = inFlightOf(table)
  // Ушедший в пакет и неизменённый черновик повторно не отправляется (ADR 0178, §5).
  const sent = drafts.filter(draft => {
    if (draft.kind !== CELL_VALUE_DRAFT || !('cell' in draft.target))
      return false
    // Черновики ячеек удалённой строки держатся, но в пакет не идут (DR28).
    if (isDeletedRow(table, draft.target.cell[0])) return false
    const entry = inFlight[cellKey(...draft.target.cell)]
    return !(
      entry?.status === 'pending' &&
      entry.text === (draft.value as CellDraftValue).text
    )
  })
  const rowDrafts = drafts.filter(
    draft => isRowDraft(draft) && !rowsFlying.has(rowKeyOf(draft)),
  )
  const insertDrafts = rowDrafts.filter(
    draft => draft.kind === ROW_INSERT_DRAFT,
  )
  const deleteDrafts = rowDrafts.filter(
    draft => draft.kind === ROW_DELETE_DRAFT,
  )
  const source = (table as ReconcileTable).getRowSource()
  const cells = sent.map(draft => {
    const [rowId, columnId] = (draft.target as { cell: [string, string] }).cell
    const { value, text } = draft.value as CellDraftValue
    return {
      rowId,
      columnId,
      value,
      text,
      original: source.byId(rowId)?.getValue(columnId),
    }
  })
  const inserts: RowInsertBatchItem[] = insertDrafts.map(draft => {
    const rowId = (draft.target as { row: string }).row
    const { values, after } = draft.value as RowInsertValue
    const index = (table as ReconcileTable).getRowSource().indexOf(rowId)
    return { rowId, values, index, ...(after ? { after } : {}) }
  })
  const deletes = deleteDrafts.map(draft => ({
    rowId: (draft.target as { row: string }).row,
  }))
  if (cells.length === 0 && inserts.length === 0 && deletes.length === 0) return
  // Место новой строки в кэше серверной модели — до ответа, пока строка стоит в списке.
  const cacheIndex = new Map(
    inserts.map(item => [item.rowId, baseIndexOfNewRow(table, item.rowId)]),
  )
  const controller = new AbortController()
  const attempt = ++lastAttempt
  const batchId = `${APPLY_BATCH}${attempt}`
  const sentDrafts = [...sent, ...rowDrafts]
  dropStaleApplyFailures(table, sentDrafts)
  const settleOwn = markOwnWrites(table, [
    ...cells,
    ...inserts.map(({ rowId }) => ({ rowId })),
  ])
  const result = hooks.onCommitEdits?.(
    {
      cells,
      ...(inserts.length > 0 ? { inserts } : {}),
      ...(deletes.length > 0 ? { deletes } : {}),
    },
    { signal: controller.signal },
  )
  settleOwnOn(result, settleOwn)
  reportOutcome(table, { plugin: ID, action: 'commit' }, result)

  // Ответ — одной записью в каждый срез: ожидание, черновики, отказы, вспышки, кэш строк (DR26).
  const settle = (
    refused: Map<string, Refusal>,
    answered: boolean,
    savedRows: Map<string, unknown>,
  ) => {
    for (const draft of rowDrafts) rowsFlying.delete(rowKeyOf(draft))
    const state = readEditingState(table)
    const submitted = { ...state.submitted }
    const accepted: FlashTarget[] = []
    const reverted: FlashTarget[] = []
    const saved = new Set<Draft>()
    const rows = new Map<string, { columnId: string; value: unknown }[]>()
    // Отказанные — их повторяет плашка итога.
    const again: FailedEditRef[] = []
    cells.forEach((cell, index) => {
      const key = cellKey(cell.rowId, cell.columnId)
      const entry = submitted[key]
      if (answered && (!entry || entry.attempt !== attempt)) return
      const target = { cell: [cell.rowId, cell.columnId] as [string, string] }
      const refusal = refused.get(key)
      if (refusal !== undefined) {
        submitted[key] = {
          rowId: cell.rowId,
          columnId: cell.columnId,
          draft: cell.value,
          text: cell.text,
          original: cell.original,
          status: 'error',
          error: refusal.reason,
          attempt,
          batch: batchId,
        }
        reverted.push(target)
        again.push({ rowId: cell.rowId, columnId: cell.columnId })
        return
      }
      delete submitted[key]
      saved.add(sent[index]!)
      const row = rows.get(cell.rowId) ?? []
      row.push({ columnId: cell.columnId, value: cell.value })
      rows.set(cell.rowId, row)
      accepted.push(target)
    })
    // Строки: принятая снимает свой черновик по ключу, удалённая — и черновики своих ячеек.
    const settledRows = new Set<string>()
    // Новые строки серверной модели с местом в кэше: черновик — до записи строки (ADR 0181, NI3).
    const cached: string[] = []
    const handedOver: string[] = []
    const add: { row: unknown; index: number | undefined }[] = []
    const remove: string[] = []
    const rowReports: FailureReport[] = []
    for (const draft of rowDrafts) {
      const rowId = (draft.target as { row: string }).row
      const refusal = refused.get(rowId)
      if (refusal !== undefined) {
        reverted.push({ row: rowId })
        rowReports.push(rowFailureReport(table, draft, refusal, batchId))
        again.push({ rowId })
        continue
      }
      settledRows.add(rowId)
      if (draft.kind === ROW_DELETE_DRAFT) {
        remove.push(rowId)
        continue
      }
      const row = savedRows.get(rowId) ?? (draft.value as RowInsertValue).values
      add.push({ row, index: cacheIndex.get(rowId) })
      const id = (table as TransactionTable).getRowId?.(row, 0)
      if (savedRows.has(rowId) && id) accepted.push({ row: id })
      const kept = savedRows.has(rowId) && keepsRowId(table, rowId, row)
      if (kept && !isServerRows(table)) handedOver.push(rowId)
      else if (kept && cacheIndex.get(rowId) !== undefined) cached.push(rowId)
    }
    const applied = saved.size + settledRows.size
    const outcome: ApplyOutcome = {
      id: batchId,
      saved: applied,
      refused: reverted.length,
      ...(again.length > 0
        ? { retry: () => retryFailedEdits(table, again) }
        : {}),
    }
    const counted = outcome.saved + outcome.refused > 0
    writeEditingState(
      table,
      { ...state, submitted, ...(counted ? { applied: outcome } : {}) },
      {
        reports: rowReports,
        resolve: [...settledRows].map(row => failureKeyOf({ row })),
      },
    )
    for (const [rowId, values] of rows) writeSavedRow(table, rowId, values)
    const t = table as TransactionTable
    if (isServerRows(table) && t.applyRowTransaction) {
      for (const { row, index } of add)
        t.applyRowTransaction({
          add: [row],
          ...(index !== undefined ? { index } : {}),
        })
      if (remove.length > 0) t.applyRowTransaction({ remove })
    }
    // Снимается только ушедший черновик ячейки: переправленный за время ожидания остаётся.
    removeDrafts(table, draft => {
      if (saved.has(draft)) return true
      const target = draft.target
      if ('row' in target)
        return (
          isRowDraft(draft) &&
          settledRows.has(target.row) &&
          !cached.includes(target.row) &&
          !handedOver.includes(target.row)
        )
      return 'cell' in target && remove.includes(target.cell[0])
    })
    removeWhenCached(table, cached)
    removeAfterAppData(table, handedOver)
    // Сверх предела итог говорят плашка и объявление (ADR 0227, AO14).
    if (reverted.length + accepted.length <= OUTCOME_FLASH_LIMIT) {
      flashOutcome(table, reverted, 'reverted')
      flashOutcome(table, accepted, 'accepted')
    }
    if (counted) reportApplyOutcome(table, outcome)
    // Применено хоть что-то — разделитель в истории (ADR 0222, §14).
    if (applied > 0)
      notifyCellsWritten(table, {
        id: batchId,
        source: 'apply',
        cells: [],
        refused: [],
        applied,
      })
  }

  /**
   * Запрос не прошёл целиком (ADR 0227, §2, AO3): отказ применения, а не ячеек — одна запись
   * реестра с целью-таблицей и повтором того же набора; черновики остаются без отметки отказа.
   */
  const fail = (reason: unknown) => {
    for (const draft of rowDrafts) rowsFlying.delete(rowKeyOf(draft))
    const state = readEditingState(table)
    const submitted = { ...state.submitted }
    const reverted: FlashTarget[] = []
    for (const cell of cells) {
      const key = cellKey(cell.rowId, cell.columnId)
      const entry = submitted[key]
      if (entry?.attempt !== attempt || entry.status !== 'pending') continue
      delete submitted[key]
      reverted.push({ cell: [cell.rowId, cell.columnId] })
    }
    for (const draft of rowDrafts)
      reverted.push({ row: (draft.target as { row: string }).row })
    const labels = announcerLabels(table) ?? ENGLISH_LABELS
    const error = rejectionText(reason) ?? labels.saveFailed
    const key = applyFailureKey(attempt)
    const keys = new Set(sentDrafts.map(keyOfDraft))
    const retry = () => {
      resolveFailure(table, key)
      openApplyFailures(table).delete(key)
      const current = readDrafts(table).filter(draft =>
        keys.has(keyOfDraft(draft)),
      )
      if (current.length > 0) commitDrafts(table, current)
    }
    openApplyFailures(table).set(key, keys)
    const outcome: ApplyOutcome = {
      id: batchId,
      saved: 0,
      refused: cells.length + rowDrafts.length,
      failed: { reason: error },
      retry,
    }
    writeEditingState(
      table,
      { ...state, submitted, applied: outcome },
      {
        reports: [
          {
            key,
            action: COMMIT_ACTION,
            target: { table: true },
            reason: error,
            retry,
            batch: batchId,
          },
        ],
      },
    )
    // Запись закрыли в журнале — уходит и плашка этого применения.
    whenFailureGone(table, key, () => closeApplyOutcome(table, batchId))
    if (reverted.length <= OUTCOME_FLASH_LIMIT)
      flashOutcome(table, reverted, 'reverted')
    reportApplyOutcome(table, outcome)
  }

  const answerOf = (answer: unknown) => {
    const batch = answer as CellEditBatchResult | undefined
    return {
      refused: new Map<string, Refusal>(
        (batch?.refused ?? []).map(item => [
          item.columnId === undefined
            ? item.rowId
            : cellKey(item.rowId, item.columnId),
          { reason: item.reason },
        ]),
      ),
      saved: new Map((batch?.saved ?? []).map(item => [item.rowId, item.row])),
    }
  }

  if (!isThenable(result)) {
    const { refused, saved } = answerOf(result)
    settle(refused, false, saved)
    return
  }
  for (const draft of rowDrafts) rowsFlying.add(rowKeyOf(draft))
  const state = readEditingState(table)
  const submitted = { ...state.submitted }
  for (const cell of cells)
    submitted[cellKey(cell.rowId, cell.columnId)] = {
      rowId: cell.rowId,
      columnId: cell.columnId,
      draft: cell.value,
      text: cell.text,
      original: cell.original,
      status: 'pending',
      attempt,
    }
  writeEditingState(table, { ...state, submitted })
  result.then(answer => {
    const { refused, saved } = answerOf(answer)
    settle(refused, true, saved)
  }, fail)
}

/** Отказ правки в ответе пакета. */
interface Refusal {
  reason: string
}

/** Применение черновиков в справочнике действий: «Сохранить» ядра (ADR 0227, §2). */
const COMMIT_ACTION = { plugin: ID, action: 'commit' }

const applyFailureKey = (attempt: number) => `cellEditing:apply:${attempt}`

const keyOfDraft = (draft: Draft) => draftKeyOf(draft.kind, draft.target)

/** Открытые отказы применения целиком: ключ записи → ключи черновиков набора (по store). */
const applyFailures = new WeakMap<object, Map<string, Set<string>>>()
const openApplyFailures = (table: unknown) => {
  const { store } = table as { store: object }
  let map = applyFailures.get(store)
  if (!map) {
    map = new Map()
    applyFailures.set(store, map)
  }
  return map
}

/**
 * Новое применение решает прежний отказ применения целиком, если весь его набор — в новом
 * пакете или черновиков набора больше нет.
 */
const dropStaleApplyFailures = (table: unknown, sent: readonly Draft[]) => {
  const open = openApplyFailures(table)
  if (open.size === 0) return
  const now = new Set(sent.map(keyOfDraft))
  const present = new Set(readDrafts(table).map(keyOfDraft))
  const stale: string[] = []
  for (const [key, keys] of open)
    if ([...keys].every(item => now.has(item) || !present.has(item)))
      stale.push(key)
  for (const key of stale) open.delete(key)
  if (stale.length > 0) resolveFailures(table, stale)
}

/** Текст итога применения — плашка и объявление (ADR 0227, §1, AO15). */
export const applyOutcomeText = (
  labels: TableLabels,
  outcome: ApplyOutcome,
): string => {
  const own = cellEditingLabels(labels)
  if (outcome.failed) return own.applyFailed(outcome.failed.reason)
  if (outcome.refused === 0) return own.applySaved(outcome.saved)
  const total = outcome.saved + outcome.refused
  return outcome.saved === 0
    ? own.applyNone(total)
    : own.applyPartly(outcome.saved, total)
}

/** Через столько мс плашка полного успеха уходит сама (ADR 0227, AO1). */
export const APPLY_SAVED_HIDE_AFTER = 3000

/** Ключ итога применения в канале плашки: новое применение заменяет прежнее (AO4). */
const APPLY_NOTICE_KEY = 'cellEditing:applied'

const failureLogOf = (table: unknown) =>
  (table as { showFailureLog?: () => void }).showFailureLog

/**
 * Действие плашки: повтор отказа целиком; при отказе части — журнал (плашка уходит, разбор —
 * в журнале), без него — повтор.
 */
const applyNoticeAction = (
  table: unknown,
  outcome: ApplyOutcome,
): TableNotice['action'] => {
  const { retry } = outcome
  if (outcome.failed)
    return retry && { label: labels => labels.loadRetry, run: retry }
  if (outcome.refused === 0 || (!failureLogOf(table) && !retry)) return
  return {
    label: labels =>
      failureLogOf(table)
        ? cellEditingLabels(labels).applyShow
        : cellEditingLabels(labels).applyRetry,
    run: () => {
      if (!failureLogOf(table)) return retry?.()
      ;(table as { showFailureLog: () => void }).showFailureLog()
      closeApplyOutcome(table, outcome.id)
    },
  }
}

/** Итог применения — плашкой цели-таблицы (ADR 0227, §1). */
const showApplyNotice = (table: unknown, outcome: ApplyOutcome) => {
  const saved = !outcome.failed && outcome.refused === 0
  // Сохранена часть — не провал: нейтральный тон; ничего и сбой запроса — вид отказа.
  const partly = !outcome.failed && outcome.refused > 0 && outcome.saved > 0
  const action = applyNoticeAction(table, outcome)
  showTableNotice(table, APPLY_NOTICE_KEY, {
    title: labels => applyOutcomeText(labels, outcome),
    ...(saved && { tone: 'success', hideAfter: APPLY_SAVED_HIDE_AFTER }),
    ...(partly && { tone: 'neutral' }),
    ...(action && { action }),
    onClose: () => closeApplyOutcome(table, outcome.id),
  })
}

/** Итог применения — одна плашка, одно объявление и действие канала (ADR 0227, AO15, AO18). */
const reportApplyOutcome = (table: unknown, outcome: ApplyOutcome) => {
  showApplyNotice(table, outcome)
  watchApplyOutcome(table, outcome)
  announceLabel(table, labels => applyOutcomeText(labels, outcome))
  reportAction(table, {
    plugin: ID,
    action: 'applied',
    detail: {
      id: outcome.id,
      saved: outcome.saved,
      refused: outcome.refused,
      ...(outcome.failed ? { failed: outcome.failed.reason } : {}),
    },
    source: 'auto',
  })
}

/** Подписка последнего частичного итога на решение его отказов (по store). */
const outcomeWatches = new WeakMap<object, () => void>()

const dropOutcomeWatch = (table: unknown) => {
  const { store } = table as { store?: object }
  if (!store) return
  outcomeWatches.get(store)?.()
  outcomeWatches.delete(store)
}

/**
 * Частичный итог уходит, когда решён последний отказ его применения: правки сброшены,
 * сохранены повтором или исправлены (ADR 0227, AO22). У итогов «всё сохранено» и «запрос не
 * прошёл» свой уход.
 */
const watchApplyOutcome = (table: unknown, outcome: ApplyOutcome) => {
  dropOutcomeWatch(table)
  const { store } = table as { store?: object }
  if (!store || outcome.failed || outcome.refused === 0) return
  outcomeWatches.set(
    store,
    whenBatchResolved(table, outcome.id, () => {
      outcomeWatches.delete(store)
      closeApplyOutcome(table, outcome.id)
    }),
  )
}

/** Итог последнего применения, пока его не закрыли; нет — `undefined`. */
export const readApplyOutcome = (table: unknown): ApplyOutcome | undefined =>
  readEditingState(table).applied

/** Итог последнего применения — перерисовывает только при его смене. */
export const useApplyOutcome = (table: unknown): ApplyOutcome | undefined =>
  useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state?: CellEditingState) => state?.applied,
  )

/** Закрыть итог применения (крестик плашки, её уход); `id` — только если он ещё последний. */
export const closeApplyOutcome = (table: unknown, id?: string) => {
  const state = readEditingState(table)
  if (state.applied && id !== undefined && state.applied.id !== id) return
  dropOutcomeWatch(table)
  closeTableNotice(table, APPLY_NOTICE_KEY)
  if (!state.applied) return
  const next = { ...state }
  delete next.applied
  writeEditingState(table, next)
}

/** Ячейка пакета операции записи: значение и прежнее значение — в типе колонки. */
export interface PackageCell {
  rowId: string
  columnId: string
  value: unknown
  text: string
  original: unknown
}

/** Действие справочника по источнику операции записи (ADR 0219, §8). */
export const writeActionOf = (source: CellWriteSource) =>
  source === 'fill'
    ? { plugin: 'cellSelection', action: 'fill' }
    : // Отмена и повтор — действия истории правок (ADR 0222): их источники пишет только она.
      source === 'undo' || source === 'redo'
      ? { plugin: 'editHistory', action: source }
      : writeActionOfEditing(source)

const writeActionOfEditing = (source: CellWriteSource) => ({
  plugin: ID,
  action:
    source === 'paste' ||
    source === 'cut' ||
    source === 'clear' ||
    source === 'fillDown' ||
    source === 'fillRight'
      ? source
      : source === 'bulk'
        ? 'bulkEdit'
        : 'write',
})

const packageStatusKey = (id: string) => `cellWrite:${id}`
const packageFailureKey = (id: string) => `cellWrite:${id}`
const packagePendingKey = (id: string) => `cellWrite:${id}:pending`

/** Номер отправки для пакета: исполнитель собирает ячейки ожидания до вызова колбэка. */
export const nextAttempt = () => ++lastAttempt

/**
 * Вспышка итога пакета — до стольких ячеек (ADR 0219, §10): сверх них итог говорит объявление,
 * а запись вспышки на каждую ячейку стала бы одной долгой задачей.
 */
export const OUTCOME_FLASH_LIMIT = 1000

/** Пакет операции записи: ячейки для колбэка и они же словарём для ожидания. */
export interface CellPackage {
  id: string
  source: CellWriteSource
  cells: readonly PackageCell[]
  /** Ячейки по ключу в виде ожидания — с номером отправки пакета. */
  pending: ReadonlyMap<string, SubmittedCell>
  /** Ячейки по ключу: волна ожидания (`false` — флажок булева ждёт без волны). */
  waves: ReadonlyMap<string, boolean>
}

const withoutKey = <T extends object>(record: T, key: string): T => {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key as keyof T]
  return next
}

/**
 * Сохранить пакет операции записи (ADR 0219, §6, §10): `onCommitEdits` одним вызовом с `id` и
 * `source`. Пока промис не решён, пакет — одна запись среза правки и одна запись ожидания со
 * словарём ячеек: ячейки ждут и показывают новые значения; «стоп» прерывает `signal` — ячейки
 * возвращают прежние значения. Отказ части — отказ на ячейках, отказ пакета целиком — одна
 * плашка таблицы с причиной и повтором, без отметок на ячейках.
 */
export const commitCellPackage = (
  table: unknown,
  pkg: CellPackage,
  announceWritten?: () => void,
) => {
  const { id, source, cells, pending, waves } = pkg
  const hooks = readPluginHooks<Partial<CellEditingHooks>>(table as never, ID)
  const action = writeActionOf(source)
  const statusKey = packageStatusKey(id)
  const pendingKey = packagePendingKey(id)
  // Повтор снимает прежнюю плашку отказа этой операции и её запись в реестре.
  writeActionStatus(table, status => withoutKey(status, statusKey))
  resolveFailure(table, packageFailureKey(id))
  const controller = new AbortController()
  const settleOwn = markOwnWrites(table, cells)
  const result = hooks.onCommitEdits?.(
    { id, source, cells },
    { signal: controller.signal },
  )
  settleOwnOn(result, settleOwn)
  reportOutcome(table, action, result)
  const name = (labels: TableLabels) => actionLabelOf(table, action, labels)
  const flashCells = (outcome: 'accepted' | 'reverted') => {
    if (cells.length > OUTCOME_FLASH_LIMIT) return
    flashOutcome(
      table,
      cells.map(cell => ({ cell: [cell.rowId, cell.columnId] })),
      outcome,
    )
  }
  const record = { id, cells: pending }
  let waiting = true
  const announceOnce = () => {
    const announce = announceWritten
    announceWritten = undefined
    announce?.()
  }
  /** Снять ожидание пакета: одна запись в срез правки и одна — в срез ожидания. */
  const dropPending = () => {
    waiting = false
    batch(() => {
      const state = readEditingState(table)
      if (state.packages?.[id] === record) {
        const packages = withoutKey(state.packages, id)
        writeEditingState(table, {
          ...state,
          packages: Object.keys(packages).length > 0 ? packages : undefined,
        })
      }
      writeActionStatus(table, status => withoutKey(status, pendingKey))
    })
  }

  const settleAnswer = (answer: unknown, answered: boolean) => {
    const batch = answer as CellEditBatchResult | undefined
    const refused = new Map(
      (batch?.refused ?? []).flatMap(item =>
        item.columnId === undefined
          ? []
          : [[cellKey(item.rowId, item.columnId), item] as const],
      ),
    )
    if (answered) dropPending()
    // Отказанные ячейки — отказом на объекте с `batch` операции (ADR 0227, AO21).
    if (refused.size > 0) {
      const state = readEditingState(table)
      const submitted = { ...state.submitted }
      const reverted: FlashTarget[] = []
      for (const [key, item] of refused) {
        const cell = pending.get(key)
        if (!cell) continue
        submitted[key] = {
          ...cell,
          status: 'error',
          error: item.reason,
          batch: id,
        }
        reverted.push({ cell: [cell.rowId, cell.columnId] })
      }
      writeEditingState(table, { ...state, submitted })
      flashOutcome(table, reverted, 'reverted')
    }
    // Серверная модель: сохранённое — в кэш строк (ADR 0139); у клиента данные пишет приложение.
    const t = table as SavedTable
    if (t.setRowData) {
      const savedRows = new Map(
        (batch?.saved ?? []).map(item => [item.rowId, item.row]),
      )
      const rows = new Map<string, { columnId: string; value: unknown }[]>()
      for (const cell of cells) {
        if (refused.has(cellKey(cell.rowId, cell.columnId))) continue
        const row = rows.get(cell.rowId) ?? []
        row.push({ columnId: cell.columnId, value: cell.value })
        rows.set(cell.rowId, row)
      }
      for (const [rowId, values] of rows) {
        const saved = savedRows.get(rowId)
        if (saved !== undefined && isSavedRow(t, rowId, saved))
          t.setRowData(rowId, () => saved)
        else writeSavedRow(table, rowId, values)
      }
    }
    if (refused.size === 0) flashCells('accepted')
    notifyPackage(table, pkg, refused)
    if (answered)
      announceLabel(table, all =>
        refused.size === 0
          ? cellEditingLabels(all).announceWriteSaved(name(all))
          : cellEditingLabels(all).announceWriteFailed(
              name(all),
              [...refused.values()][0]?.reason ?? all.saveFailed,
            ),
      )
  }

  if (!isThenable(result)) {
    announceOnce()
    settleAnswer(result, false)
    return
  }

  // Пункт «Отменить сохранение» любой ячейки пакета и `table.cancelPending` — весь пакет: ключ
  // ячейки пакета совпадает с id ожидания ячейки (`cellPendingId`).
  const unregister = registerPending(table, {
    kind: 'cellEdit',
    id: statusKey,
    ids: pending,
    cancel: cancelSource => {
      if (controller.signal.aborted) return
      announceOnce()
      controller.abort()
      unregister()
      dropPending()
      notifyPackage(table, pkg, undefined, 'cancelled')
      reportAction(table, {
        plugin: ID,
        action: 'cancel',
        detail: { action: action.action, id },
        source: cancelSource,
      })
      announceLabel(table, all => all.announceActionCancelled(name(all)))
    },
  })

  result.then(
    answer => {
      if (controller.signal.aborted) return lateAnswer(table)
      announceOnce()
      unregister()
      settleAnswer(answer, true)
    },
    reason => {
      if (controller.signal.aborted) return lateAnswer(table, reason)
      announceOnce()
      unregister()
      dropPending()
      const labels = announcerLabels(table) ?? ENGLISH_LABELS
      const error = rejectionText(reason) ?? labels.saveFailed
      const retry = () => commitCellPackage(table, pkg)
      const entry: ActionStatusEntry = {
        failed: true,
        table: true,
        error: reason,
        name,
        reason: () => error,
        retry,
      }
      writeActionStatus(table, status => ({ ...status, [statusKey]: entry }))
      // За записью правки нет — без `discard`; закрыли запись — уходит и плашка (ADR 0227, §6).
      const key = packageFailureKey(id)
      reportFailures(table, [
        {
          key,
          action,
          target: { table: true },
          reason: error,
          retry,
          batch: id,
        },
      ])
      whenFailureGone(table, key, () =>
        writeActionStatus(table, status =>
          // Закрытая плашка — тот же отказ с пометкой: его узнаём по повтору.
          status[statusKey]?.retry === retry
            ? withoutKey(status, statusKey)
            : status,
        ),
      )
      flashCells('reverted')
      notifyPackage(table, pkg, undefined, 'refused')
      announceLabel(table, all =>
        cellEditingLabels(all).announceWriteFailed(name(all), error),
      )
    },
  )

  const publishPending = () => {
    if (!waiting) return
    inOneCommit(() => {
      // React 18 иначе коммитит объявление раньше состояния ожидания.
      announceOnce()
      const current = readEditingState(table)
      writeEditingState(table, {
        ...current,
        packages: { ...current.packages, [id]: record },
      })
      if (!waiting) return
      writeActionStatus(table, status => ({
        ...status,
        [pendingKey]: { pending: true, cells: waves },
      }))
    })
  }
  // Крупный шаг истории даёт ответу из ближайшей микрозадачи сняться до
  // отрисовки ожидания и пересборки окна с новыми данными.
  if (
    cells.length >= DEFAULT_WRITE_LIMITS.confirm &&
    (source === 'undo' || source === 'redo')
  )
    queueMicrotask(() => queueMicrotask(publishPending))
  else queueMicrotask(publishPending)
}

/**
 * Итог пакета каналу истории (ADR 0222, §2): сохранённые ячейки без отклонённых ответом; отказ
 * пакета целиком — все отклонены, «стоп» — итог неизвестен.
 */
const notifyPackage = (
  table: unknown,
  {
    id,
    source,
    cells,
    pending,
  }: Pick<CellPackage, 'id' | 'source' | 'cells' | 'pending'>,
  refused?: ReadonlyMap<string, unknown>,
  whole?: 'refused' | 'cancelled',
) =>
  notifyCellsWritten(table, () => {
    const allSaved = !whole && !refused?.size
    const saved: WrittenCell[] = allSaved
      ? cells.map(({ rowId, columnId, original, value }) => ({
          rowId,
          columnId,
          before: original,
          after: value,
        }))
      : []
    const lost: { rowId: string; columnId: string }[] = []
    if (!allSaved && whole !== 'cancelled') {
      for (const { rowId, columnId, original, value } of cells) {
        if (whole === 'refused' || refused?.has(cellKey(rowId, columnId)))
          lost.push({ rowId, columnId })
        else saved.push({ rowId, columnId, before: original, after: value })
      }
    }
    return {
      id,
      source,
      cells: saved,
      uniqueCells: pending.size === cells.length,
      refused: lost,
      ...(whole === 'cancelled' ? { cancelled: true } : {}),
    }
  })

/**
 * Итог пакета, сохранённого по ячейкам через `onCellEdit` или черновиками (ADR 0222, §2): одно
 * сообщение, когда решились все ячейки.
 */
const notifyCells = (
  table: unknown,
  id: string,
  source: CellWriteSource,
  cells: readonly PackageCell[],
) => {
  const outcomes: (boolean | 'cancelled')[] = []
  let left = cells.length
  return (index: number) => (outcome: boolean | 'cancelled') => {
    outcomes[index] = outcome
    if (--left > 0) return
    notifyCellsWritten(table, {
      id,
      source,
      cells: cells.flatMap((cell, k) =>
        outcomes[k] === true
          ? [
              {
                rowId: cell.rowId,
                columnId: cell.columnId,
                before: cell.original,
                after: cell.value,
              },
            ]
          : [],
      ),
      refused: cells.flatMap((cell, k) =>
        outcomes[k] === false
          ? [{ rowId: cell.rowId, columnId: cell.columnId }]
          : [],
      ),
      ...(outcomes.includes('cancelled') ? { cancelled: true } : {}),
    })
  }
}

/** Сохранить ячейки по одной через `onCellEdit` — без `onCommitEdits` (ADR 0219, §6). */
export const submitCells = (
  table: unknown,
  cells: readonly PackageCell[],
  operation: { id: string; source: CellWriteSource },
) => {
  const hooks = readPluginHooks<Partial<CellEditingHooks>>(table as never, ID)
  const settled = notifyCells(table, operation.id, operation.source, cells)
  cells.forEach((cell, index) =>
    submitValue(table, cell, cell.value, cell.text, cell.original, hooks, {
      onSettled: settled(index),
      batch: operation.id,
    }),
  )
}

/**
 * Записать значения пакета черновиками одной записью в срез (ADR 0219, WR11): совпавшее с
 * данными снимает черновик, новая строка пишет значения в свой черновик `rowInsert`.
 */
export const storeCellDrafts = (
  table: unknown,
  cells: readonly PackageCell[],
  operation?: { id: string; source: CellWriteSource },
) => {
  // Итог черновиками — сразу: показанное значение «до» читается до записи (ADR 0222, §8).
  if (operation)
    notifyCellsWritten(table, {
      ...operation,
      cells: cells.map(cell => ({
        rowId: cell.rowId,
        columnId: cell.columnId,
        before: shownValueOf(table, cell.rowId, cell.columnId),
        after: cell.value,
      })),
      refused: [],
      draft: true,
    })
  const set: Draft[] = []
  const remove: { kind: string; target: { cell: [string, string] } }[] = []
  const newRows = new Map<string, PackageCell[]>()
  for (const cell of cells) {
    if (isNewRow(table, cell.rowId)) {
      const list = newRows.get(cell.rowId) ?? []
      list.push(cell)
      newRows.set(cell.rowId, list)
      continue
    }
    const target = { cell: [cell.rowId, cell.columnId] as [string, string] }
    if (
      sameEditValue(
        table,
        cell.columnId,
        cell.value,
        dataValueOf(table, cell.rowId, cell.columnId),
      )
    ) {
      remove.push({ kind: CELL_VALUE_DRAFT, target })
      continue
    }
    const value: CellDraftValue = { value: cell.value, text: cell.text }
    set.push({ kind: CELL_VALUE_DRAFT, target, value })
  }
  writeDrafts(table, set, remove)
  for (const [rowId, list] of newRows)
    writeNewRowValues(table, rowId, values =>
      list.reduce((row, cell) => {
        const key = (table as SavedTable).getColumn?.(cell.columnId)?.columnDef
          .accessorKey
        if (typeof key !== 'string') {
          warnNotWritten(table)
          return row
        }
        return setAtPath(row, key, cell.value) as Record<string, unknown>
      }, values),
    )
}

/**
 * Отказ строки пакета — запись реестра с повтором и откатом (ADR 0177): отметки у строки нет,
 * итог говорит объявление применения (ADR 0227, AO15).
 */
const rowFailureReport = (
  table: unknown,
  draft: Draft,
  { reason }: Refusal,
  batch: string,
): FailureReport => {
  const rowId = (draft.target as { row: string }).row
  return {
    action: {
      plugin: 'cellEditing',
      action: draft.kind === ROW_INSERT_DRAFT ? 'rowInsert' : 'rowDelete',
    },
    target: { row: rowId },
    reason,
    batch,
    retry: () => {
      const current = readDrafts(table).find(
        item => rowKeyOf(item) === rowKeyOf(draft),
      )
      if (current) commitDrafts(table, [current])
    },
    // Тем же путём, что пульт: сбрасывание — запись истории (ADR 0222, §14).
    discard: () => discardFailedEdits(table, [{ rowId }]),
    bulk: bulkOf(table, true),
  }
}

/**
 * Отмена ждущего сохранения — тихо, как «Сбросить» (ADR 0177, §8): в ячейке снова значение из
 * данных, черновик — в `onEditCancel` с причиной `cancel`, вспышки и отметки нет.
 */
const cancelSubmitted = (
  table: unknown,
  key: string,
  attempt: number,
  source: CancelSource,
  hooks: Partial<CellEditingHooks>,
) => {
  const state = readEditingState(table)
  const entry = state.submitted[key]
  if (!entry || entry.attempt !== attempt || entry.status !== 'pending') return
  const submitted = { ...state.submitted }
  delete submitted[key]
  writeEditingState(table, { ...state, submitted })
  reportAction(table, {
    plugin: ID,
    action: 'cancel',
    detail: { action: 'save', rowId: entry.rowId, columnId: entry.columnId },
    source,
  })
  const name = columnNameOf(table, entry.columnId)
  announceLabel(table, all => all.announceActionCancelled(name))
  hooks.onEditCancel?.({
    rowId: entry.rowId,
    columnId: entry.columnId,
    reason: 'cancel',
    draft: entry.draft,
    text: entry.text,
    original: entry.original,
  })
}

interface ReconcileTable extends SessionTable {
  getRowSource: () => RowSource<ReconcileRow>
  getAllLeafColumns: () => { id: string; columnDef?: { header?: unknown } }[]
  getAllLeafColumnsById: () => Record<string, { id: string } | undefined>
}

interface ReconcileRow extends SessionRow {
  getAllCells: () => {
    column: { id: string }
    getContext: () => unknown
  }[]
}

const hasCell = (table: ReconcileTable, { rowId, columnId }: Cell) =>
  !!table.getRowSource().byId(rowId) &&
  !!table.getAllLeafColumnsById()[columnId]

/**
 * Отправленные ячейки, ушедшие из таблицы или выключенного плагина, снимаются; отклонённая,
 * чьё значение изменилось извне, — тоже, с причиной `conflict` (ADR 0177, §5). Черновик
 * отклонённой уходит в `onEditCancel`. Поздний итог снятого промиса
 * игнорируется (`settleSubmitted`).
 */
const reconcileSubmitted = (
  table: ReconcileTable,
  enabled: boolean,
  hooks: Partial<CellEditingHooks>,
) => {
  const state = readEditingState(table)
  const entries = Object.entries(state.submitted)
  if (entries.length === 0) {
    return
  }
  const dropped: [SubmittedCell, EditCancelReason][] = []
  const source = table.getRowSource()
  const columns = table.getAllLeafColumnsById()
  // Серверная модель: строки нет в кэше — она не загружена или вытеснена (ADR 0227, AO20).
  const partial = !!source.whenLoaded
  for (const [, entry] of entries) {
    // «Ошибку», открытую в правку, ведёт активная сессия.
    if (isEditingCell(state.active, entry.rowId, entry.columnId)) {
      continue
    }
    const row = source.byId(entry.rowId)
    if ((!row && !partial) || !columns[entry.columnId]) {
      dropped.push([entry, 'unavailable'])
    } else if (!enabled) {
      dropped.push([entry, 'revoke'])
    } else if (
      entry.status === 'error' &&
      entry.batch?.startsWith(APPLY_BATCH) &&
      !cellDraftOf(table, entry.rowId, entry.columnId)
    ) {
      // Отказ применения уходит с черновиком: его сбросили (ADR 0227, §6).
      dropped.push([entry, 'cancel'])
    } else if (
      row &&
      entry.status === 'error' &&
      !Object.is(row.getValue(entry.columnId), entry.original)
    ) {
      dropped.push([entry, 'conflict'])
    }
  }
  if (dropped.length === 0) {
    return
  }
  const submitted = { ...state.submitted }
  for (const [entry] of dropped) {
    delete submitted[cellKey(entry.rowId, entry.columnId)]
  }
  writeEditingState(table, { ...state, submitted })
  for (const [entry, reason] of dropped) {
    if (entry.status === 'error') {
      hooks.onEditCancel?.({
        rowId: entry.rowId,
        columnId: entry.columnId,
        reason,
        draft: entry.draft,
        text: entry.text,
        original: entry.original,
        error: entry.error,
      })
    }
  }
}

const pruneCellDrafts = (table: ReconcileTable) => {
  const source = table.getRowSource() as RowSource<ReconcileRow> & {
    whenLoaded?: unknown
  }
  if (source.whenLoaded) return
  // Строк первой загрузки ещё нет: черновики, восстановленные приложением, ждут их (DR49).
  if (commonOptionsOf(table).loading === 'initial') return
  for (const draft of readDrafts(table)) {
    if (draft.kind !== CELL_VALUE_DRAFT || !('cell' in draft.target)) continue
    if (!source.byId(draft.target.cell[0]))
      removeDraft(table, draft.kind, draft.target)
  }
}

/**
 * Согласование с таблицей после рендера. Активная сессия: строка или колонка ушла —
 * `unavailable`; плагин выключен или `canEditCell` запретил ячейку — `revoke`. Ячейка вне
 * экрана, на другой странице, в скрытой колонке — сессия жива. Отправленные ячейки —
 * `reconcileSubmitted`.
 */
export const reconcileEditSession = (
  table: unknown,
  { enabled, hooks }: PluginReconcileContext,
) => {
  const cellHooks = hooks as Partial<CellEditingHooks>
  const t = table as ReconcileTable
  syncAppSubmitted(table)
  reconcileSubmitted(t, enabled, cellHooks)
  pruneCellDrafts(t)
  const session = readEditSession(table)
  if (!session) {
    return
  }
  const { rowId, columnId } = session.cell
  if (!hasCell(t, session.cell)) {
    cancelEditSession(table, 'unavailable', cellHooks)
    return
  }
  if (!enabled) {
    cancelEditSession(table, 'revoke', cellHooks)
    return
  }
  const cell = t
    .getRowSource()
    .byId(rowId)!
    .getAllCells()
    .find(item => item.column.id === columnId)
  if (
    cell &&
    cellHooks.canEditCell &&
    !cellHooks.canEditCell(cell.getContext() as CellComponentProps)
  ) {
    cancelEditSession(table, 'revoke', cellHooks)
  }
}
