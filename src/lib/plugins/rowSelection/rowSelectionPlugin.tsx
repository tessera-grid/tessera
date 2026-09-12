import { logWarn } from '../../core/logger'
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
  createRow: (_staticRow, table) => {
    // Выбор строк несовместим с АКТИВНОЙ группировкой: сгруппированная модель
    // производна и временна (строки-группы имеют синтетические id), поэтому
    // выбор владеется rowGrouping и отключается — по аналогии с rowDragging
    // (ADR 0022). Пока группировка лишь включена, но не применена, выбор
    // работает как обычно. Оборачиваем getCanSelect, чтобы и агрегаты
    // (getCanSomeRowsSelect, getIsAllPageRowsSelected) были согласованы.
    const originalGetCanSelect = _staticRow.getCanSelect
    _staticRow.getCanSelect = () => {
      if ((table.getState().grouping?.length ?? 0) > 0) {
        logWarn(
          table,
          'rowSelection: выбор строк недоступен при активной группировке — модель строк производна и временна, выбором владеет rowGrouping. Само включение плагина группировки выбор не трогает. См. ADR 0022.',
          'rowSelection:grouping',
        )
        return false
      }
      return originalGetCanSelect()
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
