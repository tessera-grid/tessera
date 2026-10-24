/**
 * Сессия правки ячейки (ADR 0040, §2): начало, черновик, завершение и
 * согласование с таблицей. Сессию ведёт плагин, а не смонтированный редактор —
 * она переживает прокрутку, смену страницы, сортировку и скрытие колонки.
 * Сохранение с промисом отделяет ячейку от активной правки в `submitted`
 * (ADR 0041, §2): правка других ячеек не ждёт сервера.
 */
import { announceLabel, announcerLabels } from '../../core/announcer'
import type { PluginReconcileContext } from '../../core/features'
import { DEFAULT_LABELS } from '../../core/localization'
import {
  type DebugActionSource,
  reportAction,
  reportOutcome,
  sourceOf,
} from '../../core/debugActions'
import { isThenable, rejectionText } from '../../core/thenable'
import {
  pluginStateKey,
  readPluginHooks,
  setPluginState,
} from '../../core/definePlugin'
import type { CellComponentProps } from '../../core/createSlots'
import { flashOutcome } from '../../core/flashes/flashFeature'
import type {
  CellEditingHooks,
  CellEditingState,
  EditCancelReason,
  EditingCell,
  EditSession,
  SubmittedCell,
} from './types'

const ID = 'cellEditing'
export const EDIT_SESSION_KEY = pluginStateKey(ID)

export const EMPTY_EDITING_STATE: CellEditingState = {
  active: null,
  submitted: {},
}

interface SessionRow {
  id: string
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

const writeEditingState = (table: unknown, next: CellEditingState) =>
  setPluginState(table, ID, next)

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
  if (isCellPending(table, row.id, column.id)) {
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
  // Из «ошибки» — с отклонённым черновиком и текстом отказа (ADR 0041, §2).
  const failed = readEditingState(table).submitted[cellKey(row.id, column.id)]
  const original = failed ? failed.original : row.getValue(column.id)
  const session: EditSession = {
    cell: { rowId: row.id, columnId: column.id },
    draft: failed ? failed.draft : String(original ?? ''),
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

export const setEditDraft = (table: unknown, draft: string) => {
  const state = readEditingState(table)
  if (state.active && state.active.draft !== draft) {
    reportAction(table, {
      plugin: ID,
      action: 'changeDraft',
      detail: { draft },
      source: 'keyboard',
    })
    writeEditingState(table, {
      ...state,
      active: { ...state.active, draft },
    })
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

/** Черновик совпадает с исходным значением ячейки — сохранять нечего (ADR 0040, SS18). */
export const isUnchangedCommit = (session: EditingCell, value: string) =>
  !!session && value === String(session.original ?? '')

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
    original: session.original,
    ...(current ? { current: current.value } : {}),
    ...(session.rejected ? { error: session.rejected.error } : {}),
  })
}

// Номер отправки сквозной: снятое и заново отправленное сохранение той же ячейки не
// спутать с поздним итогом прежнего.
let lastAttempt = 0

const settleSubmitted = (
  table: unknown,
  key: string,
  attempt: number,
  outcome: { ok: true } | { ok: false; reason: unknown },
) => {
  const state = readEditingState(table)
  const entry = state.submitted[key]
  if (!entry || entry.attempt !== attempt || entry.status !== 'pending') {
    return
  }
  const submitted = { ...state.submitted }
  if (outcome.ok) {
    delete submitted[key]
    writeEditingState(table, { ...state, submitted })
    flashOutcome(table, { cell: [entry.rowId, entry.columnId] }, 'accepted')
    return
  }
  const labels = announcerLabels(table) ?? DEFAULT_LABELS
  const error = rejectionText(outcome.reason) ?? labels.saveFailed
  submitted[key] = { ...entry, status: 'error', error }
  writeEditingState(table, { ...state, submitted })
  // Значение в ячейке вернулось к данным — в том же кадре, что отказ на кнопке правки.
  flashOutcome(table, { cell: [entry.rowId, entry.columnId] }, 'reverted')
  announceLabel(table, all =>
    all.announceSaveFailed(columnNameOf(table, entry.columnId), error),
  )
}

const columnNameOf = (table: unknown, columnId: string) => {
  const header = (table as ReconcileTable)
    .getAllLeafColumns()
    .find(column => column.id === columnId)?.columnDef?.header
  return typeof header === 'string' ? header : columnId
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
  value: string,
  hooks: Partial<CellEditingHooks>,
) => {
  const session = readEditSession(table)
  if (!isEditingCell(session, cell.rowId, cell.columnId)) {
    return
  }
  const { rowId, columnId } = cell
  const { original } = session!
  const row = (table as ReconcileTable).getCoreRowModel().rowsById[rowId]
  const now = row ? row.getValue(columnId) : original
  const changed = !Object.is(now, original)
  if (changed && hooks.onConflict === 'block') {
    setEditDraft(table, value)
    cancelEditSession(table, 'conflict', hooks, { value: now })
    return
  }
  reportEditEnd(table, cell, { result: 'commit', value })
  const result = hooks.onCellEdit?.({
    rowId,
    columnId,
    value,
    original,
    ...(changed ? { current: now } : {}),
  })
  reportOutcome(table, { plugin: ID, action: 'save' }, result)
  if (!isThenable(result)) {
    endEditSession(table)
    return
  }
  const state = readEditingState(table)
  const key = cellKey(rowId, columnId)
  const attempt = ++lastAttempt
  writeEditingState(table, {
    active: null,
    submitted: {
      ...state.submitted,
      [key]: {
        rowId,
        columnId,
        draft: value,
        original,
        status: 'pending',
        attempt,
      },
    },
  })
  result.then(
    () => settleSubmitted(table, key, attempt, { ok: true }),
    reason => settleSubmitted(table, key, attempt, { ok: false, reason }),
  )
}

interface ReconcileTable extends SessionTable {
  getCoreRowModel: () => { rowsById: Record<string, ReconcileRow | undefined> }
  getAllLeafColumns: () => { id: string; columnDef?: { header?: unknown } }[]
}

interface ReconcileRow extends SessionRow {
  getAllCells: () => {
    column: { id: string }
    getContext: () => unknown
  }[]
}

const hasCell = (table: ReconcileTable, { rowId, columnId }: Cell) =>
  !!table.getCoreRowModel().rowsById[rowId] &&
  table.getAllLeafColumns().some(column => column.id === columnId)

/**
 * Отправленные ячейки, ушедшие из таблицы или выключенного плагина, снимаются;
 * черновик отклонённой уходит в `onEditCancel`. Поздний итог снятого промиса
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
        original: entry.original,
        error: entry.error,
      })
    }
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
  reconcileSubmitted(t, enabled, cellHooks)
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
    .getCoreRowModel()
    .rowsById[rowId]!.getAllCells()
    .find(item => item.column.id === columnId)
  if (
    cell &&
    cellHooks.canEditCell &&
    !cellHooks.canEditCell(cell.getContext() as CellComponentProps)
  ) {
    cancelEditSession(table, 'revoke', cellHooks)
  }
}
