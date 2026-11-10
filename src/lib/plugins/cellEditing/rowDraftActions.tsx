/**
 * Откат строки до сохранения (ADR 0178, §7, DR32): кнопка в колонке действий строки — «Убрать
 * строку» или «Вернуть строку». Пункт контекстного меню — у плагина `contextMenu`.
 */
import { Undo2 } from 'lucide-react'

import { discardDraft, readDrafts } from '../../core/drafts/drafts'
import type { RowAction } from '../../core/headerActions'
import { ROW_DELETE_DRAFT, ROW_INSERT_DRAFT, isNewRow } from './rowDrafts'
import { cellEditingLabels } from './labels'

const rowDraftOf = (table: unknown, rowId: string) =>
  readDrafts(table).find(
    draft =>
      (draft.kind === ROW_INSERT_DRAFT || draft.kind === ROW_DELETE_DRAFT) &&
      'row' in draft.target &&
      draft.target.row === rowId,
  )

export const rowDraftAction: RowAction = {
  id: 'cellEditing:rowDraftDiscard',
  slot: 'actionRowSlot',
  order: -10,
  icon: () => <Undo2 width={16} height={16} />,
  label: labels => cellEditingLabels(labels).actionRowDraftDiscard,
  action: ({ table, row }) =>
    isNewRow(table, row.id) ? 'rowInsertDiscard' : 'rowDeleteDiscard',
  // Убрать новую строку — потеря её значений; вернуть удалённую — нет (ADR 0206).
  tone: ({ table, row }) => (isNewRow(table, row.id) ? 'danger' : undefined),
  visible: ({ table, row }) => !!rowDraftOf(table, row.id),
  // Видна без наведения, без точки черновика: строку и так выдаёт её вид.
  shown: () => true,
  onSelect: ({ table, row }) => {
    const draft = rowDraftOf(table, row.id)
    if (draft) discardDraft(table, draft)
  },
}
