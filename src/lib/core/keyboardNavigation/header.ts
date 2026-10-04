/** Владелец позиции в шапке: какой заголовок покрывает строку/колонку навигации. */
import { getDisplayColumns } from '../displayColumns'
import { getHeaderRows } from '../headerSpans'
import {
  type ActiveCell,
  type NavHeader,
  type NavTable,
  getNavRowCount,
} from './model'

/** Индекс строки навигации заголовка: его верхняя видимая строка (`< 0`). */
export const getHeaderRowIndex = (
  header: unknown,
  headerRowCount: number,
): number =>
  (getHeaderRows(header as NavHeader)[0] ?? headerRowCount - 1) - headerRowCount

const headerOwnerGrids = new WeakMap<object, (NavHeader | undefined)[][]>()

/**
 * Сетка владельцев шапки `[строка][колонка]`: заголовок, чей бокс покрывает
 * позицию (группа — несколько колонок, растянутый лист — несколько строк).
 */
const getHeaderOwnerGrid = (t: NavTable) => {
  const groups = t.getHeaderGroups()
  let grid = headerOwnerGrids.get(groups)
  if (!grid) {
    const { indexById } = getDisplayColumns(t)
    const owners: (NavHeader | undefined)[][] = groups.map(() => [])
    for (const group of groups) {
      for (const header of group.headers) {
        const rows = getHeaderRows(header)
        for (const leaf of header.getLeafHeaders()) {
          const column = indexById.get(leaf.column.id)
          if (column === undefined) continue
          for (const row of rows) {
            if (owners[row]) owners[row][column] = header
          }
        }
      }
    }
    grid = owners
    headerOwnerGrids.set(groups, grid)
  }
  return grid
}

/** Заголовок, владеющий позицией `(rowIndex < 0, columnIndex)` шапки. */
export const getHeaderOwner = (
  t: NavTable,
  rowIndex: number,
  columnIndex: number,
): NavHeader | undefined => {
  const grid = getHeaderOwnerGrid(t)
  return grid[grid.length + rowIndex]?.[columnIndex]
}

/**
 * Стрелка в шапке переходит к следующему владельцу: шаг сквозь бокс, растянутый на
 * несколько колонок (группа) или строк (растянутый лист); за краем — на месте.
 */
export const skipHeaderSpans = (
  t: NavTable,
  active: ActiveCell,
  next: ActiveCell,
  key: string,
): ActiveCell => {
  if (next.rowIndex >= 0) {
    return next
  }
  const current =
    active.rowIndex < 0
      ? getHeaderOwner(t, active.rowIndex, active.columnIndex)
      : undefined
  const same = (row: number, column: number) =>
    getHeaderOwner(t, row, column) === current
  const top = -t.getHeaderGroups().length
  const lastRow = getNavRowCount(t) - 1
  const lastColumn = getDisplayColumns(t).ids.length - 1
  let { rowIndex, columnIndex } = next
  switch (key) {
    case 'ArrowUp':
      while (rowIndex >= top && same(rowIndex, columnIndex)) rowIndex--
      return rowIndex < top ? active : { rowIndex, columnIndex }
    case 'ArrowDown':
      while (rowIndex < 0 && same(rowIndex, columnIndex)) rowIndex++
      return rowIndex > lastRow ? active : { rowIndex, columnIndex }
    case 'ArrowLeft':
      while (columnIndex >= 0 && same(rowIndex, columnIndex)) columnIndex--
      return columnIndex < 0 ? active : { rowIndex, columnIndex }
    case 'ArrowRight':
      while (columnIndex <= lastColumn && same(rowIndex, columnIndex))
        columnIndex++
      return columnIndex > lastColumn ? active : { rowIndex, columnIndex }
    default:
      return next
  }
}
