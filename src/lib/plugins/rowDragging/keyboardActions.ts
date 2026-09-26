/**
 * Клавиатурная альтернатива перетаскиванию строк: `Alt+Shift+↑/↓` на любой ячейке
 * строки переставляет её с соседней строкой того же уровня (ADR 0031, KB4),
 * `Alt+Shift+→/←` вкладывает её в предыдущую группу / выносит на уровень выше
 * (ADR 0032, W12). Изменения — через тот же `onRowOrderChange`, что у DnD.
 */
import type { CellKeyboardAction } from '../../core/keyboardActions'
import { isMovableRow, moveRow, nestRow, unnestRow } from './moveRow'

export const moveRowKeyboardAction: CellKeyboardAction = {
  id: 'rowDragging.move',
  scope: 'cell',
  keys: ['Alt+Shift+ArrowUp', 'Alt+Shift+ArrowDown'],
  visible: ({ row, table }) => isMovableRow(row, table),
  run: ({ row, table }, event) =>
    moveRow(row, table, event.key === 'ArrowUp' ? -1 : 1),
}

/**
 * `→` — корневая строка без подстрок становится последней подстрокой предыдущей
 * корневой группы (раскрываемой строки); `←` — подстрока встаёт в корень сразу
 * после родителя. Группа в группу не вкладывается — как у DnD.
 */
export const nestRowKeyboardAction: CellKeyboardAction = {
  id: 'rowDragging.nest',
  scope: 'cell',
  keys: ['Alt+Shift+ArrowRight', 'Alt+Shift+ArrowLeft'],
  visible: ({ row, table }) => isMovableRow(row, table),
  run: ({ row, table }, event) =>
    event.key === 'ArrowLeft' ? unnestRow(row, table) : nestRow(row, table),
}
