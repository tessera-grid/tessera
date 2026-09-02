import {
  _getVisibleLeafColumns,
  getMemoOptions,
  memo,
} from '@tanstack/react-table'

import { stateUpdater } from '../../core/createState/stateUpdater'
import { TablePlugin } from '../types'
import { ColumnDraggingComponent } from './ColumnDraggingComponent'
import { getColumnDraggingEvents } from './getColumnDraggingEvents'

export const columnDraggingPlugin: TablePlugin = {
  // Плагин сам сеет свой слайс overlay-состояния и его updater (ADR 0010): ядро
  // больше не управляет columnDraggingActiveId вручную.
  getInitialState: state => ({
    columnDraggingActiveId: null,
    ...state,
  }),
  getDefaultOptions: table => ({
    onColumnDraggingActiveIdChange: stateUpdater('columnDraggingActiveId', table),
  }),
  createColumn: (_staticColumn, table) => {
    _staticColumn.getCanDrag = () => {
      if (table.getHeaderGroups().length !== 1) {
        return false
      }

      return (
        !!_staticColumn.columnDef.enableDragging &&
        !!table.options.enableColumnDragging
      )
    }

    _staticColumn.getDraggableIndex = memo(
      () => [_getVisibleLeafColumns(table)],
      columns =>
        columns
          .filter(column => column.getCanDrag())
          .findIndex(d => d.id === _staticColumn.id),
      getMemoOptions(table.options, 'debugColumns', 'getDraggableIndex'),
    )
  },
  createTable: table => {
    const { onColumnDragStart, onColumnDragEnd } =
      getColumnDraggingEvents(table)

    table.setOptions({
      ...table.options,
      onColumnDragStart,
      onColumnDragEnd,
    })

    table.setRenderSlot({
      id: 'columnDraggingPlugin',
      slot: 'leftHeaderSlot',
      order: 0,
      component: ColumnDraggingComponent,
    })
  },
}
