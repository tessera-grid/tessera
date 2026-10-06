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

export const getCellExpandingStyles = ({
  column,
  rowDepth,
  table,
}: CellExpandingStylesParams): { paddingLeft: string | undefined } => {
  const firstUserColumn = table
    .getAllLeafColumns()
    .find(visibleColumn => !visibleColumn.getIsActionsColumn())

  // Шаг — из темы (ADR 0059): JS передаёт только глубину.
  if (firstUserColumn?.id === column.id && rowDepth > 0) {
    return {
      paddingLeft: `calc(var(${ROW_NESTING_INDENT_TOKEN}) * ${rowDepth})`,
    }
  }

  return { paddingLeft: undefined }
}

/**
 * Линии дерева глубже первого уровня (ADR 0058): тени линии первого уровня со сдвигом
 * на шаг отступа; `none` — у строки первого уровня одна линия.
 */
export const treeLineShadows = (depth: number): string =>
  depth > 1
    ? Array.from(
        { length: depth - 1 },
        (_, i) =>
          `calc(var(${ROW_NESTING_INDENT_TOKEN}) * ${i + 1}) 0 0 0 var(--tsr-comp-tree-line-color)`,
      ).join(', ')
    : 'none'
