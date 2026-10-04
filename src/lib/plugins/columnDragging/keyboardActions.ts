/**
 * Клавиатурная альтернатива перетаскиванию колонок (ADR 0031, KB3):
 * `Alt+Shift+←/→` на заголовке переставляет колонку к соседней перетаскиваемой
 * незакреплённой — с тем же `setColumnOrder` и `onColumnDragEnd`, что у DnD; группу
 * — среди соседей её уровня (ADR 0052, ND5).
 */
import type { HeaderKeyboardAction } from '../../core/keyboardActions'
import { isMovableColumn, moveColumn } from './moveColumn'

export const moveColumnKeyboardAction: HeaderKeyboardAction = {
  id: 'columnDragging.move',
  scope: 'header',
  keys: ['Alt+Shift+ArrowLeft', 'Alt+Shift+ArrowRight'],
  visible: ({ header }) => isMovableColumn(header),
  run: ({ header, table }, event) =>
    moveColumn(table, header, event.key === 'ArrowLeft' ? -1 : 1),
}
