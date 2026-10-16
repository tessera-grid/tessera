/** Синхронизация активной ячейки с выделением плагина cellSelection. */
import { getDisplayColumns } from '../displayColumns'
import {
  type ActiveCell,
  type Direction,
  type NavTable,
  ROW_FOCUS_COLUMN,
  isFooterRowIndex,
} from './model'
import type { NavigationKeyEvent } from './resolveKey'

/** Клавиши меняют выделение только с плагином интерфейса (ADR 0120). */
const isCellSelectionActive = (t: NavTable) =>
  typeof t.setFocusedCell === 'function' &&
  t.options.enableCellSelection !== false &&
  (t.options as { cellSelectionInteraction?: boolean })
    .cellSelectionInteraction === true

/**
 * Схлопнуть выделение в активную ячейку тела; на невыбираемой ячейке (служебная
 * колонка, шапка, футер) — снять его, чтобы оно не оставалось позади фокуса.
 */
export const collapseSelectionTo = (t: NavTable, active: ActiveCell) => {
  if (!isCellSelectionActive(t)) {
    return
  }
  const row =
    active.rowIndex >= 0 ? t.getRowModel().rows[active.rowIndex] : undefined
  const columnId = getDisplayColumns(t).ids[active.columnIndex]
  const cell = row?.getVisibleCells()[active.columnIndex]
  if (!row || !columnId || !(cell?.getCanSelect?.() ?? true)) {
    t.setCellSelection?.(() => [])
    return
  }
  t.setFocusedCell!(row.id, columnId)
}

/** Сдвинуть фокус активного диапазона до края таблицы в направлении `direction`. */
const extendSelectionToEdge = (t: NavTable, direction: Direction) => {
  const rows = t.getRowModel().rows
  // Как у стоковой фичи: колонка вне выбора только по column-level opt-out.
  const columnIds = getDisplayColumns(t).ids.filter(
    id => t.getColumn?.(id)?.columnDef.enableCellSelection !== false,
  )
  const vertical = direction === 'up' || direction === 'down'
  const ids = vertical ? rows.map(row => row.id) : columnIds
  const target =
    direction === 'up' || direction === 'left' ? ids[0] : ids.at(-1)
  if (target === undefined) {
    return
  }
  const key = vertical ? 'focusRowId' : 'focusColumnId'
  t.setCellSelection?.(old =>
    old.length
      ? [...old.slice(0, -1), { ...old[old.length - 1], [key]: target }]
      : old,
  )
}

/**
 * Shift+стрелка: расширить диапазон на шаг, Ctrl+Shift+стрелка — до края таблицы;
 * якорь — активная ячейка.
 */
export const extendSelectionFrom = (
  t: NavTable,
  active: ActiveCell,
  direction: Direction,
  toEdge: boolean,
): boolean => {
  if (
    !isCellSelectionActive(t) ||
    typeof t.extendCellSelection !== 'function' ||
    t.options.enableCellRangeSelection === false ||
    active.rowIndex < 0 ||
    isFooterRowIndex(t, active.rowIndex) ||
    active.columnIndex === ROW_FOCUS_COLUMN
  ) {
    return false
  }
  const row = t.getRowModel().rows[active.rowIndex]
  const columnId = getDisplayColumns(t).ids[active.columnIndex]
  const focused = t.getFocusedCell?.()
  if (
    row &&
    columnId &&
    (focused?.row.id !== row.id || focused?.column.id !== columnId)
  ) {
    collapseSelectionTo(t, active)
  }
  if (toEdge) {
    extendSelectionToEdge(t, direction)
  } else {
    t.extendCellSelection(direction)
  }
  return true
}

export const isSelectAllKey = (event: NavigationKeyEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === 'a'

/** Ctrl+A: выделить все ячейки; без cellSelection клавиша остаётся браузеру. */
export const selectAllCellsIn = (t: NavTable): boolean => {
  if (
    !isCellSelectionActive(t) ||
    typeof t.selectAllCells !== 'function' ||
    t.options.enableCellRangeSelection === false
  ) {
    return false
  }
  t.selectAllCells()
  return true
}
