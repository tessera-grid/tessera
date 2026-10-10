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
 * Линии дерева (ADR 0058): слой маски на каждый уровень строки, сдвинутый на шаг
 * отступа.
 */
export const treeLineMasks = (depth: number) => ({
  '--tsr-tree-masks': Array(depth).fill('var(--tsr-tree-line-mask)').join(', '),
  '--tsr-tree-mask-positions': Array.from(
    { length: depth },
    (_, level) => `calc(var(${ROW_NESTING_INDENT_TOKEN}) * ${level}) 0`,
  ).join(', '),
})
