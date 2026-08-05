import { TablePlugin } from '../types'
import { RowDraggingComponent } from './RowDraggingComponent'
import { COLUMN_DRAGGING_ID } from './rowDraggingColumn'

export const rowDraggingPlugin: TablePlugin = {
  createRow: (_staticRow, table) => {
    const enableRowDragging = table.options.enableRowDragging

    _staticRow.getCanDrag = () => {
      if (
        table.getHeaderGroups().length !== 1 ||
        table.options.enableGrouping
      ) {
        return false
      }

      if (typeof enableRowDragging === 'function') {
        return enableRowDragging(_staticRow)
      }

      return !!enableRowDragging
    }
  },
  createCell: _staticCell => {
    if (_staticCell.column.id !== COLUMN_DRAGGING_ID) return

    _staticCell.renderComponent = RowDraggingComponent
  },
}
