/**
 * Сессия правки ячейки (ADR 0040, §2): начало, черновик, завершение и
 * согласование с таблицей. Сессию ведёт плагин, а не смонтированный редактор —
 * она переживает прокрутку, смену страницы, сортировку и скрытие колонки.
 */
import type { PluginReconcileContext } from '../../core/features'
import { pluginStateKey, setPluginState } from '../../core/definePlugin'
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

export const startEditSession = (
  table: unknown,
  row: SessionRow,
  column: { id: string },
) => {
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
