/**
 * Клавиатурная альтернатива перетаскиванию колонок (ADR 0031, KB3):
 * `Alt+Shift+←/→` на заголовке переставляет колонку к соседней перетаскиваемой
 * незакреплённой — с тем же `setColumnOrder` и `onColumnDragEnd`, что у DnD; группу
 * — среди соседей её уровня (ADR 0052, ND5).
 */
import type { HeaderKeyboardAction } from '../../core/keyboardActions'
import { isMovableColumn, moveColumn } from './moveColumn'
import { columnDraggingLabels } from './labels'

export const moveColumnKeyboardAction: HeaderKeyboardAction = {
  id: 'columnDragging.move',
  scope: 'header',
  keys: ['Alt+Shift+ArrowLeft', 'Alt+Shift+ArrowRight'],
  shortcut: {
    combo: 'Alt+Shift+ArrowLeft',
    section: 'moving',
    label: labels => columnDraggingLabels(labels).moveColumn,
  },
  visible: ({ header }) => isMovableColumn(header),
  run: ({ header, table }, event) =>
    moveColumn(table, header, event.key === 'ArrowLeft' ? -1 : 1),
}
