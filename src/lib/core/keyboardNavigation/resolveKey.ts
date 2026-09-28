/** Чистый резолвер навигационных клавиш: следующая активная ячейка без DOM. */
import type { ActiveCell } from './model'

export interface NavigationKeyEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export interface NavigationBounds {
  rowCount: number
  columnCount: number
  /** Сколько строк помещается в видимую часть тела (шаг PageUp/PageDown). */
  pageRows: number
  /** Число строк шапки (> 1 — вложенная); по умолчанию 1. */
  headerRowCount?: number
}

/**
 * Следующая активная ячейка по клавише или `null`, если клавиша не навигационная.
 * Строки — от `-headerRowCount` (верх шапки) до `rowCount - 1`; кламп на краях.
 */
export const resolveNavigationKey = (
  active: ActiveCell,
  event: NavigationKeyEvent,
  { rowCount, columnCount, pageRows, headerRowCount = 1 }: NavigationBounds,
): ActiveCell | null => {
  if (event.shiftKey) {
    return null
  }
  const lastRow = rowCount - 1
  const lastColumn = Math.max(columnCount - 1, 0)
  const clampRow = (row: number) =>
    Math.min(Math.max(row, -headerRowCount), lastRow)
  const clampColumn = (column: number) =>
    Math.min(Math.max(column, 0), lastColumn)
  const ctrl = event.ctrlKey || event.metaKey
  const { rowIndex, columnIndex } = active

  // Alt+↑/↓ — на экран: замена PageUp/PageDown для компактных клавиатур (KB13).
  if (event.altKey) {
    if (ctrl) {
      return null
    }
    if (event.key === 'ArrowUp') {
      return { rowIndex: clampRow(rowIndex - pageRows), columnIndex }
    }
    if (event.key === 'ArrowDown') {
      return { rowIndex: clampRow(rowIndex + pageRows), columnIndex }
    }
    return null
  }

  // Ctrl+стрелка — к краю: замена Home/End и Ctrl+Home/End (KB11).
  switch (event.key) {
    case 'ArrowUp':
      return {
        rowIndex: ctrl ? -headerRowCount : clampRow(rowIndex - 1),
        columnIndex,
      }
    case 'ArrowDown':
      return { rowIndex: clampRow(ctrl ? lastRow : rowIndex + 1), columnIndex }
    case 'ArrowLeft':
      return { rowIndex, columnIndex: ctrl ? 0 : clampColumn(columnIndex - 1) }
    case 'ArrowRight':
      return {
        rowIndex,
        columnIndex: ctrl ? lastColumn : clampColumn(columnIndex + 1),
      }
    case 'Home':
      return ctrl
        ? { rowIndex: -headerRowCount, columnIndex: 0 }
        : { rowIndex, columnIndex: 0 }
    case 'End':
      return ctrl
        ? { rowIndex: clampRow(lastRow), columnIndex: lastColumn }
        : { rowIndex, columnIndex: lastColumn }
    case 'PageUp':
      return { rowIndex: clampRow(rowIndex - pageRows), columnIndex }
    case 'PageDown':
      return { rowIndex: clampRow(rowIndex + pageRows), columnIndex }
    default:
      return null
  }
}
