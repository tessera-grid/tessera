/**
 * getCellExpandingStyles: отступ вложенности на первой пользовательской колонке
 * (getVisibleLeafColumns + getIsActionsColumn из commonFeature); шаг — токен темы.
 */
import { ROW_NESTING_INDENT_TOKEN } from '../core/rowNesting'

type ExpandingColumn = { id: string; getIsActionsColumn: () => boolean }
type ExpandingTable = {
  // getAllLeafColumns — ядровый (getVisibleLeafColumns из columnVisibilityFeature,
  // не всегда в наборе). Видимость учтём, если понадобится.
  getAllLeafColumns: () => ExpandingColumn[]
}

export interface CellExpandingStylesParams {
  column: ExpandingColumn
  rowDepth: number
  table: ExpandingTable
}

/** Колонка отступа вложенности — первая пользовательская. */
export const isIndentColumn = (
  column: ExpandingColumn,
  table: ExpandingTable,
) =>
  table.getAllLeafColumns().find(leaf => !leaf.getIsActionsColumn())?.id ===
  column.id

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
