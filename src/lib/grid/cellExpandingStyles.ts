/**
 * getCellExpandingStyles: отступ вложенности на первой колонке данных в порядке отображения —
 * закреплённые слева, центр, закреплённые справа, без скрытых и служебных (ADR 0059, RE80);
 * шаг — токен темы. Там же линии дерева (ADR 0058).
 */
import { getDisplayColumns } from '../core/displayColumns'
import { ROW_NESTING_INDENT_TOKEN } from '../core/rowNesting'

type ExpandingColumn = { id: string; getIsActionsColumn: () => boolean }
type ExpandingTable = {
  getVisibleLeafColumns: () => ExpandingColumn[]
  getStartVisibleLeafColumns?: () => ExpandingColumn[]
  getCenterVisibleLeafColumns?: () => ExpandingColumn[]
  getEndVisibleLeafColumns?: () => ExpandingColumn[]
}

export interface CellExpandingStylesParams {
  column: ExpandingColumn
  rowDepth: number
  table: ExpandingTable
}

/** Колонка отступа вложенности — первая колонка данных на экране. */
export const isIndentColumn = (
  column: ExpandingColumn,
  table: ExpandingTable,
) =>
  getDisplayColumns(table).columns.find(leaf => !leaf.getIsActionsColumn())
    ?.id === column.id

export const getCellExpandingStyles = ({
  column,
  rowDepth,
  table,
}: CellExpandingStylesParams): { paddingLeft: string | undefined } => {
  // Шаг — из темы (ADR 0059): JS передаёт только глубину.
  if (rowDepth > 0 && isIndentColumn(column, table)) {
    return {
      paddingLeft: `calc(var(${ROW_NESTING_INDENT_TOKEN}) * ${rowDepth})`,
    }
  }

  return { paddingLeft: undefined }
}
