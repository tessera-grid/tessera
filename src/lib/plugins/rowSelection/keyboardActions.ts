/**
 * Клавиатурное действие rowSelection (ADR 0021): `Space` на любой ячейке тела
 * переключает выбор строки — тем же путём, что и клик по чекбоксу.
 */
import type { CellKeyboardAction } from '../../core/keyboardActions'
import { readPluginHooks } from '../../core/definePlugin'
import type { Row } from '../../types'
import { isGroupingActive } from '../rowSelectionModel/selectionHelpers'
import type { RowSelectionHooks } from './types'

/** Может ли строка переключаться сейчас (те же гейты, что у чекбокса строки). */
export const getCanToggleRow = (
  row: Row<any, any>,
  table: unknown,
  hooks: Partial<RowSelectionHooks>,
): boolean =>
  !isGroupingActive(table) &&
  !(row.depth > 0 && !row.getCanSelectSubRows()) &&
  row.getCanSelect() &&
  !hooks.isAllRowsSelected

/** Переключить выбор строки и уведомить `onSelectRow` (общий путь клика и клавиши). */
export const toggleRowSelection = (
  row: Row<any, any>,
  hooks: Partial<RowSelectionHooks>,
  event: unknown,
): void => {
  row.getToggleSelectedHandler()(event)
  hooks.onSelectRow?.(row, !row.getIsSelected())
}

export const toggleRowKeyboardAction: CellKeyboardAction = {
  id: 'rowSelection.toggle',
  scope: 'cell',
  keys: [' '],
  visible: ({ row, table }) =>
    getCanToggleRow(
      row,
      table,
      readPluginHooks<Partial<RowSelectionHooks>>(table, 'rowSelection'),
    ),
  run: ({ row, table }, event) =>
    toggleRowSelection(
      row,
      readPluginHooks<Partial<RowSelectionHooks>>(table, 'rowSelection'),
      event,
    ),
}
