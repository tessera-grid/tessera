import { TablePlugin } from '../types'
import { HeadSelectionComponent } from './HeadSelectionComponent'
import { RowSelectionComponent } from './RowSelectionComponent'
import { COLUMN_SELECTION_ID } from './rowSelectionColumn'

export const rowSelectionPlugin: TablePlugin = {
  createTable: table => {
    table.getCanSomeRowsSelect = () => {
      return table.getRowModel().rows.some(row => row.getCanSelect())
    }
  },
  createHeader: _staticHeader => {
    if (_staticHeader.column.columnDef.id !== COLUMN_SELECTION_ID) return

    _staticHeader.renderComponent = HeadSelectionComponent
  },
  createCell: _staticCell => {
    if (_staticCell.column.id !== COLUMN_SELECTION_ID) return

    _staticCell.renderComponent = RowSelectionComponent
  },
}
