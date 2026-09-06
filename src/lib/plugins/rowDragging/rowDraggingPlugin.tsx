import { stateUpdater } from '../../core/createState/stateUpdater'
import { TablePlugin } from '../types'
import { RowDraggingComponent } from './RowDraggingComponent'
import { COLUMN_DRAGGING_ID } from './rowDraggingColumn'
import { DEFAULT_ROW_DRAG_OVERLAY_STATE } from './types'

export const rowDraggingPlugin: TablePlugin = {
  // Плагин сам сеет свой слайс overlay-состояния и его updater (ADR 0010): ядро
  // больше не управляет rowDragging вручную.
  getInitialState: state => ({
    rowDragging: DEFAULT_ROW_DRAG_OVERLAY_STATE,
    ...state,
  }),
  getDefaultOptions: table => ({
    onRowDraggingChange: stateUpdater('rowDragging', table),
  }),
  createRow: (_staticRow, table) => {
    _staticRow.getCanDrag = () => {
      if (
        table.getHeaderGroups().length !== 1 ||
        table.options.enableGrouping
      ) {
        return false
      }

      // Опцию читаем в момент вызова (как columnDragging.getCanDrag), чтобы
      // live-тумблер плагина срабатывал без пересоздания строк.
      const enableRowDragging = table.options.enableRowDragging

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
