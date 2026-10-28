/**
 * Клавиатурное действие rowSelection (ADR 0021): `Space` на любой ячейке тела
 * переключает выбор строки — тем же путём, что и клик по чекбоксу.
 */
import type { CellKeyboardAction } from '../../core/keyboardActions'
import { readPluginHooks } from '../../core/definePlugin'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import {
  groupSelectionOf,
  isAllSelection,
  rowSelectionValueOf,
  setAllSelectionRow,
  setGroupSelected,
  tableAllSelection,
} from '../../core/rowSelectionAll'
import type { Row } from '../../types'
import {
  groupingLength,
  groupKeysOfRow,
  isGroupingActive,
  isSelectableInList,
  isServerGroupRow,
} from '../rowSelectionModel/selectionHelpers'
import type { RowSelectionHooks } from './types'

/** Может ли строка переключаться сейчас (те же гейты, что у чекбокса строки). */
export const getCanToggleRow = (
  row: Row<any, any>,
  table: unknown,
  hooks: Partial<RowSelectionHooks>,
): boolean =>
  !isGroupingActive(table) &&
  isSelectableInList(row) &&
  row.getCanSelect() &&
  !hooks.isAllRowsSelected

/** Состояние флажка строки-группы по срезу (ADR 0148, §1). */
export const groupSelectionOfRow = (row: Row<any, any>) => {
  const value = rowSelectionValueOf(row.table)
  return isAllSelection(value)
    ? groupSelectionOf(value, groupKeysOfRow(row))
    : 'none'
}

/**
 * Переключить выбор строки и уведомить `onSelectRow` (общий путь клика и клавиши). Строка-
 * группа серверной группировки выбирает группу целиком; `onSelectRow` по её строкам не
 * зовётся (ADR 0148, «Границы»).
 */
export const toggleRowSelection = (
  row: Row<any, any>,
  hooks: Partial<RowSelectionHooks>,
  event: unknown,
): void => {
  if (isServerGroupRow(row)) {
    setGroupSelected(
      row.table,
      groupKeysOfRow(row),
      groupSelectionOfRow(row) !== 'all',
    )
    return
  }
  // «Всё, кроме» (ADR 0138, §9) и серверная группировка (ADR 0148): снятый флажок —
  // исключение в узле группы строки, поставленный — без него.
  if (
    tableAllSelection(row.table) ||
    (serverRowModelReason(row.table) && groupingLength(row.table) > 0)
  ) {
    setAllSelectionRow(
      row.table,
      row.id,
      !row.getIsSelected(),
      groupKeysOfRow(row),
    )
  } else {
    row.getToggleSelectedHandler()(event)
  }
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
