/**
 * Клавиатурная альтернатива перетаскиванию колонок (ADR 0031, KB3):
 * `Alt+Shift+←/→` на заголовке переставляет колонку к соседней перетаскиваемой
 * незакреплённой — с тем же `setColumnOrder` и `onColumnDragEnd`, что у DnD.
 */
import type { HeaderKeyboardAction } from '../../core/keyboardActions'
import { isMovableColumn, moveColumn } from './moveColumn'

export const moveColumnKeyboardAction: HeaderKeyboardAction = {
  id: 'columnDragging.move',
  scope: 'header',
  keys: ['Alt+Shift+ArrowLeft', 'Alt+Shift+ArrowRight'],
  visible: ({ header, column }) =>
    header.subHeaders.length === 0 && isMovableColumn(column),
  run: ({ column, table }, event) =>
    moveColumn(table, column, event.key === 'ArrowLeft' ? -1 : 1),
}
