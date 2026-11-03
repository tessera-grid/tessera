/**
 * Черновик значения ячейки в режиме сохранения по кнопке (ADR 0178, §5): вид `cellValue`
 * реестра черновиков. Применяет его пакет `onCommitEdits`; «Применить всё» сначала завершает
 * открытую правку.
 */
import { readPluginHooks } from '../../core/definePlugin'
import { rowSourceOf } from '../../core/rowSource'
import { editTextOf } from './editValue'
import { type DraftKind, readDrafts } from '../../core/drafts/drafts'
import {
  CELL_VALUE_DRAFT,
  type CellDraftValue,
  EDIT_SESSION_KEY,
  commitDrafts,
  readEditSession,
  saveEdit,
} from './session'
import type { CellEditingHooks, CellEditingState } from './types'

const hooksOf = (table: unknown) =>
  readPluginHooks<Partial<CellEditingHooks>>(table as never, 'cellEditing')

/** Открытая правка — в черновик: её значение и текст, как при Enter. */
const finishOpenEdit = (table: unknown) => {
  const session = readEditSession(table)
  if (!session) return
  saveEdit(
    table,
    session.cell,
    { value: session.draft, text: session.text },
    hooksOf(table),
  )
}

export const cellValueDraftKind: DraftKind = {
  kind: CELL_VALUE_DRAFT,
  label: labels => labels.cellDraftKind,
  describe: (_labels, draft) => (draft.value as CellDraftValue).text,
  // Значение из данных; строка не загружена (серверная модель) — прежнего не знаем.
  previous: (_labels, draft, table) => {
    if (!('cell' in draft.target)) return undefined
    const [rowId, columnId] = draft.target.cell
    const row = rowSourceOf<{ getValue: (id: string) => unknown }>(table).byId(
      rowId,
    )
    return row ? editTextOf(table, columnId, row.getValue(columnId)) : undefined
  },
  apply: (table, draft) => commitDrafts(table, [draft]),
  applyAll: table => {
    finishOpenEdit(table)
    commitDrafts(
      table,
      readDrafts(table).filter(draft => draft.kind === CELL_VALUE_DRAFT),
    )
  },
  openKey: EDIT_SESSION_KEY,
  isOpen: state => !!(state as CellEditingState | undefined)?.active,
  active: table => hooksOf(table).saveMode === 'manual',
}
