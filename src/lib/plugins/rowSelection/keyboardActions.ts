/**
 * Клавиатурное действие rowSelection (ADR 0021): `Space` на любой ячейке тела
 * переключает выбор строки — тем же путём, что и клик по чекбоксу.
 */
import type { CellKeyboardAction } from '../../core/keyboardActions'
import { readPluginHooks } from '../../core/definePlugin'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import {
  branchSelectionOf,
  groupSelectionOf,
  isAllSelection,
  rowSelectionValueOf,
  setAllSelectionRow,
  setBranchRowSelected,
  setGroupSelected,
  tableAllSelection,
} from '../../core/rowSelectionAll'
import type { Row } from '../../types'
import {
  clientGroupStateOf,
  groupKeysOfRow,
  isBranchCascade,
  isClientGroupRow,
  isSelectableInList,
  isServerGroupRow,
  rowPathOf,
  subRowsOf,
} from '../rowSelectionModel/selectionHelpers'
import { setScopeSelected } from './selectAllScope'
import type { RowSelectionHooks } from './types'

/** Может ли строка переключаться сейчас (те же гейты, что у чекбокса строки). */
export const getCanToggleRow = (row: Row<any, any>): boolean =>
  isSelectableInList(row) && row.getCanSelect()

/** Состояние флажка строки-группы по срезу (ADR 0148, §1). */
export const groupSelectionOfRow = (row: Row<any, any>) => {
  const value = rowSelectionValueOf(row.table)
  return isAllSelection(value)
    ? groupSelectionOf(value, groupKeysOfRow(row))
    : 'none'
}

/**
 * Флажок строки дерева серверной модели при каскаде (ADR 0162, §2): она и её ветка выбраны
 * целиком, частично или нет.
 */
export const branchSelectionOfRow = (row: Row<any, any>) => {
  const value = rowSelectionValueOf(row.table)
  return isAllSelection(value)
    ? branchSelectionOf(value, rowPathOf(row), row.id)
    : row.getIsSelected()
      ? 'all'
      : 'none'
}

/**
 * Флажок строки: строка-группа и строка дерева серверной модели с каскадом — по своему узлу
 * (ADR 0148; ADR 0162); «только строка» — без третьего состояния (ADR 0162, §1).
 */
export const rowCheckboxOf = (row: Row<any, any>) => {
  const nodeState = isServerGroupRow(row)
    ? groupSelectionOfRow(row)
    : isBranchCascade(row.table)
      ? branchSelectionOfRow(row)
      : undefined
  return {
    selected: nodeState ? nodeState === 'all' : row.getIsSelected(),
    indeterminate: nodeState
      ? nodeState === 'some'
      : subRowsOf(row.table) !== 'self' && row.getIsSomeSelected(),
  }
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
  // Клиентская группа — не в срезе: выбор ложится на её строки одной записью (ADR 0185, §2).
  if (isClientGroupRow(row)) {
    const { rows, state } = clientGroupStateOf(row)
    setScopeSelected(row.table, rows, state !== 'all')
    return
  }
  if (isServerGroupRow(row)) {
    setGroupSelected(
      row.table,
      groupKeysOfRow(row),
      groupSelectionOfRow(row) !== 'all',
    )
    return
  }
  // Дерево серверной модели с каскадом (ADR 0162, §2): строка — исключение в узле родителя,
  // её ветка — в том же состоянии целиком; у листа ветки нет.
  if (isBranchCascade(row.table)) {
    const selected = branchSelectionOfRow(row) !== 'all'
    setBranchRowSelected(
      row.table,
      row.id,
      rowPathOf(row),
      selected,
      row.getCanExpand(),
    )
    hooks.onSelectRow?.(row, selected)
    return
  }
  // «Всё, кроме» (ADR 0138, §9) и серверная группировка (ADR 0148): снятый флажок —
  // исключение в узле группы строки, поставленный — без него. В серверной модели
  // строки нет в модели TanStack: стоковый переключатель её не находит.
  if (tableAllSelection(row.table) || serverRowModelReason(row.table)) {
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
  // Shift+Space — выбор строки и на ячейке, где пробел занят её действием (ADR 0175, ED20).
  keys: [' ', 'Shift+ '],
  visible: ({ row }) => getCanToggleRow(row),
  run: ({ row, table }, event) =>
    toggleRowSelection(
      row,
      readPluginHooks<Partial<RowSelectionHooks>>(table, 'rowSelection'),
      event,
    ),
}
