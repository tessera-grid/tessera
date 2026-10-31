/**
 * Клавиатурная навигация — возможность ядра (ADR 0021, ADR 0170): активная ячейка, roving
 * tabindex, клавиатурный резолвер, довод в вид и фокус. Включает её опция
 * `enableKeyboardNavigation`, срез активной ячейки — под ключом `keyboardNavigation`
 * записи ядра (`entry.ts`).
 *
 * Активная ячейка — в модельных индексах: `rowIndex` в источнике строк (`getRowSource()`, ADR 0138)
 * (`-1` — листовая строка заголовка), `columnIndex` — позиция колонки в порядке
 * отображения (закреплённые start → центр → закреплённые end).
 * Ячейки читают «я активна?» гранулярно (`useTableState`): при переходе
 * ре-рендерятся только прежняя и новая активные.
 */

export {
  KEYBOARD_NAVIGATION,
  HEADER_ROW_INDEX,
  INITIAL_ACTIVE_CELL,
  NAV_BODY_END_ATTR,
  NAV_CELL_ATTR,
  NAV_ROW_ATTR,
  ROW_FOCUS_COLUMN,
  type ActiveCell,
  isKeyboardNavigationEnabled,
  isTreeGrid,
  isFooterRowIndex,
} from './model'
export { getHeaderRowIndex } from './header'
export { followActiveCell } from './followActiveCell'
export {
  resolveNavigationKey,
  type NavigationBounds,
  type NavigationKeyEvent,
} from './resolveKey'
export {
  useKeyboardNavigationGrid,
  type KeyboardNavigationGrid,
} from './useKeyboardNavigationGrid'
export {
  KeyboardNavigationContext,
  useActiveCellIndex,
  useKeyboardNavigationCell,
  useKeyboardNavigationRow,
  type KeyboardNavigationCell,
} from './useKeyboardNavigationCell'
