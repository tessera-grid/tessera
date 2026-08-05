import { TablePlugin } from '../types'
import { RowExpandingComponent } from './RowExpandingComponent'
import { COLUMN_EXPANDING_ID } from './rowExpandingColumn'

export const DEFAULT_MAX_EXPANDING_DEPTH = 1

export const rowExpandingPlugin: TablePlugin = {
  createRow: (_staticRow, table) => {
    const originalGetCanExpand = _staticRow.getCanExpand

    _staticRow.getCanExpand = () => {
      if (table.options.enableGrouping) {
        return originalGetCanExpand()
      }

      const accessDepth = _staticRow.depth < table.options.maxExpandingDepth

      const enableRowExpanding =
        typeof table.options.enableRowExpanding === 'function'
          ? table.options.enableRowExpanding(_staticRow)
          : !!table.options.enableRowExpanding

      return enableRowExpanding && accessDepth
    }
  },
  createCell: cell => {
    if (cell.column.id !== COLUMN_EXPANDING_ID) return

    cell.renderComponent = RowExpandingComponent
  },
}
