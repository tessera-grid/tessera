/**
 * Сессия правки ячейки (ADR 0040, §2): начало, черновик, завершение и
 * согласование с таблицей. Сессию ведёт плагин, а не смонтированный редактор —
 * она переживает прокрутку, смену страницы, сортировку и скрытие колонки.
 */
import type { PluginReconcileContext } from '../../core/features'
import {
  pluginStateKey,
  readPluginHooks,
  setPluginState,
} from '../../core/definePlugin'
import type { CellComponentProps } from '../../core/createSlots'
import type {
  CellEditingHooks,
  EditCancelReason,
  EditingCell,
  EditSession,
} from './types'

const ID = 'cellEditing'
export const EDIT_SESSION_KEY = pluginStateKey(ID)

interface SessionRow {
  id: string
  getValue: (columnId: string) => unknown
}

type SessionTable = {
  atoms: Record<string, { get: () => unknown } | undefined>
}

export const readEditSession = (table: unknown): EditingCell =>
  ((table as SessionTable).atoms[EDIT_SESSION_KEY]?.get() as EditingCell) ??
  null

export const isEditingCell = (
  session: EditingCell,
  rowId: string,
  columnId: string,
) => session?.cell.rowId === rowId && session.cell.columnId === columnId

/**
 * Открыть правку ячейки. Открытая сессия другой ячейки (недопустимое значение,
 * оставшееся после потери фокуса) завершается `cancel` — черновик не пропадает молча.
 */
export const startEditSession = (
  table: unknown,
  row: SessionRow,
  column: { id: string },
) => {
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
  const original = row.getValue(column.id)
  const session: EditSession = {
    cell: { rowId: row.id, columnId: column.id },
    draft: String(original ?? ''),
    original,
  }
  setPluginState(table, ID, session)
}

export const setEditDraft = (table: unknown, draft: string) => {
  const session = readEditSession(table)
  if (session && session.draft !== draft) {
    setPluginState(table, ID, { ...session, draft })
  }
}

export const endEditSession = (table: unknown) =>
  setPluginState(table, ID, null)

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
  hooks.onEditCancel?.({
    rowId: session.cell.rowId,
    columnId: session.cell.columnId,
    reason,
    draft: session.draft,
    original: session.original,
    ...(current ? { current: current.value } : {}),
  })
}

/**
 * Сохранить значение сессии этой ячейки (ADR 0040, §3–§4). Сессии нет — уже
 * завершена (Enter, Escape) и потеря фокуса после неё ничего не делает. Значение
 * изменилось извне: по умолчанию сохранение проходит с `original`/`current`, при
 * `onConflict: 'block'` — завершение с `conflict`.
 */
export const commitEditSession = (
  table: unknown,
  cell: { rowId: string; columnId: string },
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
  endEditSession(table)
  hooks.onCellEdit?.({
    rowId,
    columnId,
    value,
    original,
    ...(changed ? { current: now } : {}),
  })
}

interface ReconcileTable extends SessionTable {
  getCoreRowModel: () => { rowsById: Record<string, ReconcileRow | undefined> }
  getAllLeafColumns: () => { id: string }[]
}

interface ReconcileRow extends SessionRow {
  getAllCells: () => {
    column: { id: string }
    getContext: () => unknown
  }[]
}

/**
 * Согласование открытой сессии с таблицей после рендера: строка или колонка ушла —
 * `unavailable`; плагин выключен или `canEdit` запретил ячейку — `revoke`.
 * Ячейка вне экрана, на другой странице, в скрытой колонке — сессия жива.
 */
export const reconcileEditSession = (
  table: unknown,
  { enabled, hooks }: PluginReconcileContext,
) => {
  const session = readEditSession(table)
  if (!session) {
    return
  }
  const cellHooks = hooks as Partial<CellEditingHooks>
  const t = table as ReconcileTable
  const { rowId, columnId } = session.cell
  const row = t.getCoreRowModel().rowsById[rowId]
  const hasColumn = t.getAllLeafColumns().some(column => column.id === columnId)
  if (!row || !hasColumn) {
    cancelEditSession(table, 'unavailable', cellHooks)
    return
  }
  if (!enabled) {
    cancelEditSession(table, 'revoke', cellHooks)
    return
  }
  const cell = row.getAllCells().find(item => item.column.id === columnId)
  if (
    cell &&
    cellHooks.canEdit &&
    !cellHooks.canEdit(cell.getContext() as CellComponentProps)
  ) {
    cancelEditSession(table, 'revoke', cellHooks)
  }
}
