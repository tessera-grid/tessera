/**
 * Cutover (grid-слой) — v9-порт getCellExpandingStyles: отступ вложенности на
 * первой пользовательской колонке. Логика идентична v8 (getVisibleLeafColumns +
 * getIsActionsColumn из commonFeature). Константа отступа переиспользуется из ядра.
 */
import { ROW_NESTING_INDENT_PX } from '../../lib/core/rowNesting'

type ExpandingColumn = { id: string; getIsActionsColumn: () => boolean }
type ExpandingTable = {
  // getAllLeafColumns — ядровый (getVisibleLeafColumns из columnVisibilityFeature,
  // не всегда в наборе). Видимость учтём на cutover, если понадобится.
  getAllLeafColumns: () => ExpandingColumn[]
}

export interface CellExpandingStylesParams {
  column: ExpandingColumn
  rowDepth: number
  table: ExpandingTable
}

export const getCellExpandingStyles = ({
  column,
  rowDepth,
  table,
}: CellExpandingStylesParams): { paddingLeft: number | undefined } => {
  const firstUserColumn = table
    .getAllLeafColumns()
    .find(visibleColumn => !visibleColumn.getIsActionsColumn())

  if (firstUserColumn?.id === column.id) {
    return { paddingLeft: ROW_NESTING_INDENT_PX * rowDepth }
  }

  return { paddingLeft: undefined }
}
