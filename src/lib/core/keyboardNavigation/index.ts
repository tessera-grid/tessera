/**
 * Ядровой шов клавиатурной навигации (плагин keyboardNavigation): активная ячейка,
 * roving tabindex, клавиатурный резолвер, довод в вид и фокус. Ядро НЕ импортит
 * плагин — presence читается по опции `enableKeyboardNavigation`, слайс — по ключу
 * `keyboardNavigation` (его seed'ит локальный `state` плагина через definePlugin).
 *
 * Активная ячейка — в модельных индексах: `rowIndex` в `getRowModel().rows`
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
  useActiveCellIndex,
  useKeyboardNavigationCell,
  useKeyboardNavigationRow,
  type KeyboardNavigationCell,
} from './useKeyboardNavigationCell'
