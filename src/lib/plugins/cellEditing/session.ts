/**
 * Сессия правки ячейки (ADR 0040, §2): начало, черновик, завершение и
 * согласование с таблицей. Сессию ведёт плагин, а не смонтированный редактор —
 * она переживает прокрутку, смену страницы, сортировку и скрытие колонки.
 * Сохранение с промисом отделяет ячейку от активной правки в `submitted`
 * (ADR 0041, §2): правка других ячеек не ждёт сервера.
 */
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
  lateAnswer,
  registerPending,
} from '../../core/cancellation'
import type { RowSource } from '../../core/rowSource'
import { inferDataType, setAtPath } from './columnDataType'
import { isNumericBase } from '../../core/dataTypeFormat'
import { logWarn } from '../../util/logger'
import { isThenable, rejectionText } from '../../util/thenable'
import {
  pluginStateKey,
  readPluginHooks,
  setPluginState,
} from '../../core/definePlugin'
import type { CellComponentProps } from '../../core/createSlots'
import { flashOutcome } from '../../core/flashes/flashFeature'
import type { FlashTarget } from '../../core/highlights/highlightFeature'
import {
  cellFailureKey,
  reportFailure,
  resolveFailure,
} from '../../core/failures/failuresFeature'
import {
  type ActionStatus,
  writeActionStatus,
} from '../../core/headerActions/actionStatusFeature'
import { columnOf, editTextOf, parseEditText, sameEditValue } from './editValue'
import {
  type Draft,
  readDrafts,
  removeDraft,
  removeDrafts,
  setDraft as putDraft,
} from '../../core/drafts/drafts'
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
const reportEditEnd = (
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

const writeEditingState = (table: unknown, next: CellEditingState) => {
  const prev = readEditingState(table).submitted
  setPluginState(table, ID, next)
  syncSubmitted(table, prev, next.submitted)
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
 * (у булева — его флажок, ADR 0176), отказ — запись реестра отказов с повтором и «Отбросить»;
 * по ней ячейка рисует треугольник.
 */
const syncSubmitted = (
  table: unknown,
  prev: Record<string, SubmittedCell>,
  next: Record<string, SubmittedCell>,
) => {
  synced.set((table as { store: object }).store, next)
  if (prev === next) return
  const pendingGone: string[] = []
  const pendingNew: SubmittedCell[] = []
  for (const [key, entry] of Object.entries(prev)) {
    const now = next[key]
    if (now && sameAttempt(entry, now)) continue
    if (entry.status === 'pending') pendingGone.push(key)
    if (entry.status === 'error' && now?.status !== 'error')
      resolveFailure(table, cellFailureKey(entry.rowId, entry.columnId))
  }
  for (const [key, entry] of Object.entries(next)) {
    if (sameAttempt(prev[key], entry)) continue
    if (entry.status === 'pending') pendingNew.push(entry)
    if (entry.status === 'error') reportCellFailure(table, key, entry)
  }
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

const reportCellFailure = (
  table: unknown,
  key: string,
  entry: SubmittedCell,
) => {
  const labels = announcerLabels(table) ?? ENGLISH_LABELS
  return reportFailure(table, {
    action: EDIT_ACTION,
    target: { cell: [entry.rowId, entry.columnId] },
    reason: entry.error ?? labels.saveFailed,
    retry: () => retrySubmitted(table, key),
    discard: () => discardSubmitted(table, key),
  })
}

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
  submitValue(table, entry, entry.draft, entry.text, entry.original, hooks)
}

/** «Отбросить изменение»: отклонённое значение удаляется, черновик уходит в `onEditCancel`. */
const discardSubmitted = (table: unknown, key: string) => {
  const state = readEditingState(table)
  const entry = state.submitted[key]
  if (!entry || entry.status !== 'error') return
  removeDraft(table, CELL_VALUE_DRAFT, { cell: [entry.rowId, entry.columnId] })
  const submitted = { ...state.submitted }
  delete submitted[key]
  const active = isEditingCell(state.active, entry.rowId, entry.columnId)
    ? null
    : state.active
  writeEditingState(table, { active, submitted })
  readPluginHooks<Partial<CellEditingHooks>>(table as never, ID).onEditCancel?.(
    {
      rowId: entry.rowId,
      columnId: entry.columnId,
      reason: 'cancel',
      draft: entry.draft,
      text: entry.text,
      original: entry.original,
      ...(entry.error ? { error: entry.error } : {}),
    },
  )
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
  readDrafts(table).find(
    draft =>
      draft.kind === CELL_VALUE_DRAFT &&
      'cell' in draft.target &&
      draft.target.cell[0] === rowId &&
      draft.target.cell[1] === columnId,
  )

const dataValueOf = (table: unknown, rowId: string, columnId: string) =>
  (table as ReconcileTable).getRowSource().byId(rowId)?.getValue(columnId)

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
  return state.submitted[cellKey(rowId, columnId)] ?? null
}

/** Сохранение этой ячейки ещё ждёт сервера — повторной правки нет. */
export const isCellPending = (
  table: unknown,
  rowId: string,
  columnId: string,
) =>
  readEditingState(table).submitted[cellKey(rowId, columnId)]?.status ===
  'pending'

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
    writeEditingState(table, { active: null, submitted })
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
    storeCellDraft(table, cell, value, text)
    endEditSession(table)
    return
  }
  reportEditEnd(table, cell, { result: 'commit', value })
  submitValue(table, cell, value, text, original, hooks, {
    session: true,
    ...(changed ? { current: now } : {}),
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
  { session = false, current }: { session?: boolean; current?: unknown } = {},
) => {
  const controller = new AbortController()
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
    if (session) {
      endEditSession(table)
      return
    }
    const state = readEditingState(table)
    const submitted = { ...state.submitted }
    delete submitted[key]
    writeEditingState(table, { ...state, submitted })
    flashOutcome(table, { cell: [rowId, columnId] }, 'accepted')
    return
  }
  const state = readEditingState(table)
  const attempt = ++lastAttempt
  writeEditingState(table, {
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
    },
  })
  result.then(
    answer => {
      if (controller.signal.aborted) return lateAnswer(table)
      unregister()
      settleSubmitted(table, key, attempt, { ok: true, answer })
    },
    reason => {
      if (controller.signal.aborted) return lateAnswer(table, reason)
      unregister()
      settleSubmitted(table, key, attempt, { ok: false, reason })
    },
  )
}

/** Черновики строк в полёте по ключу: повторное «Применить всё» их не шлёт (ADR 0178, §5). */
const rowsInFlight = new WeakMap<object, Set<string>>()
const inFlightOf = (table: unknown) => {
  let keys = rowsInFlight.get(table as object)
  if (!keys) {
    keys = new Set()
    rowsInFlight.set(table as object, keys)
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
  const cells = sent.map(draft => {
    const [rowId, columnId] = (draft.target as { cell: [string, string] }).cell
    const { value, text } = draft.value as CellDraftValue
    return {
      rowId,
      columnId,
      value,
      text,
      original: dataValueOf(table, rowId, columnId),
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
  const result = hooks.onCommitEdits?.(
    {
      cells,
      ...(inserts.length > 0 ? { inserts } : {}),
      ...(deletes.length > 0 ? { deletes } : {}),
    },
    { signal: controller.signal },
  )
  reportOutcome(table, { plugin: ID, action: 'commit' }, result)

  // Ответ — одной записью в каждый срез: ожидание, черновики, вспышки, кэш строк (DR26).
  const settle = (
    refused: Map<string, string>,
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
    cells.forEach((cell, index) => {
      const key = cellKey(cell.rowId, cell.columnId)
      const entry = submitted[key]
      if (answered && (!entry || entry.attempt !== attempt)) return
      const target = { cell: [cell.rowId, cell.columnId] as [string, string] }
      const error = refused.get(key)
      if (error !== undefined) {
        submitted[key] = {
          rowId: cell.rowId,
          columnId: cell.columnId,
          draft: cell.value,
          text: cell.text,
          original: cell.original,
          status: 'error',
          error,
          attempt,
        }
        reverted.push(target)
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
    const add: { row: unknown; index: number | undefined }[] = []
    const remove: string[] = []
    for (const draft of rowDrafts) {
      const rowId = (draft.target as { row: string }).row
      const error = refused.get(rowId)
      if (error !== undefined) {
        reverted.push({ row: rowId })
        reportRowFailure(table, draft, error)
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
      if (kept && isServerRows(table) && cacheIndex.get(rowId) !== undefined)
        cached.push(rowId)
    }
    writeEditingState(table, { ...state, submitted })
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
          !cached.includes(target.row)
        )
      return 'cell' in target && remove.includes(target.cell[0])
    })
    removeWhenCached(table, cached)
    flashOutcome(table, reverted, 'reverted')
    flashOutcome(table, accepted, 'accepted')
  }
  const answerOf = (answer: unknown) => {
    const batch = answer as CellEditBatchResult | undefined
    return {
      refused: new Map(
        (batch?.refused ?? []).map(item => [
          item.columnId === undefined
            ? item.rowId
            : cellKey(item.rowId, item.columnId),
          item.reason,
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
  result.then(
    answer => {
      const { refused, saved } = answerOf(answer)
      settle(refused, true, saved)
    },
    reason => {
      const labels = announcerLabels(table) ?? ENGLISH_LABELS
      const error = rejectionText(reason) ?? labels.saveFailed
      settle(
        new Map([
          ...cells.map(
            cell => [cellKey(cell.rowId, cell.columnId), error] as const,
          ),
          ...rowDrafts.map(
            draft => [(draft.target as { row: string }).row, error] as const,
          ),
        ]),
        true,
        new Map(),
      )
    },
  )
}

/** Отказ строки пакета — отказ на объекте с повтором и откатом (ADR 0177). */
const reportRowFailure = (table: unknown, draft: Draft, reason: string) => {
  const rowId = (draft.target as { row: string }).row
  const action = {
    plugin: 'cellEditing',
    action: draft.kind === ROW_INSERT_DRAFT ? 'rowInsert' : 'rowDelete',
  }
  // Отметки у строки нет — вспышка отката, объявление и запись реестра (ADR 0177, OB13).
  announceLabel(table, all =>
    cellEditingLabels(all).announceSaveFailed(
      actionLabelOf(table, action, all),
      objectTargetText(table, { row: rowId }, all),
      reason,
    ),
  )
  reportFailure(table, {
    action,
    target: { row: rowId },
    reason,
    retry: () => {
      const current = readDrafts(table).find(
        item => item.kind === draft.kind && rowKeyOf(item) === rowKeyOf(draft),
      )
      if (current) commitDrafts(table, [current])
    },
    discard: () => removeDraft(table, draft.kind, { row: rowId }),
  })
}

/**
 * Отмена ждущего сохранения — тихо, как «Отбросить» (ADR 0177, §8): в ячейке снова значение из
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
}

interface ReconcileRow extends SessionRow {
  getAllCells: () => {
    column: { id: string }
    getContext: () => unknown
  }[]
}

const hasCell = (table: ReconcileTable, { rowId, columnId }: Cell) =>
  !!table.getRowSource().byId(rowId) &&
  table.getAllLeafColumns().some(column => column.id === columnId)

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
  for (const [, entry] of entries) {
    // «Ошибку», открытую в правку, ведёт активная сессия.
    if (isEditingCell(state.active, entry.rowId, entry.columnId)) {
      continue
    }
    if (!hasCell(table, entry)) {
      dropped.push([entry, 'unavailable'])
    } else if (!enabled) {
      dropped.push([entry, 'revoke'])
    } else if (
      entry.status === 'error' &&
      !Object.is(
        table.getRowSource().byId(entry.rowId)!.getValue(entry.columnId),
        entry.original,
      )
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
