import {
  _getVisibleLeafColumns,
  getMemoOptions,
  memo,
} from '@tanstack/react-table'

import { stateUpdater } from '../../core/createState/stateUpdater'
import { logWarn } from '../../core/logger'
import { TablePlugin } from '../types'
import { getColumnDraggingEvents } from './getColumnDraggingEvents'

export const columnDraggingPlugin: TablePlugin = {
  // Плагин сам сеет свой слайс overlay-состояния и его updater (ADR 0010): ядро
  // больше не управляет columnDraggingActiveId вручную.
  getInitialState: state => ({
    columnDraggingActiveId: null,
    ...state,
  }),
  getDefaultOptions: table => ({
    onColumnDraggingActiveIdChange: stateUpdater(
      'columnDraggingActiveId',
      table,
    ),
  }),
  createColumn: (_staticColumn, table) => {
    _staticColumn.getCanDrag = () => {
      const wantsDrag =
        !!_staticColumn.columnDef.enableDragging &&
        !!table.options.enableColumnDragging

      if (table.getHeaderGroups().length !== 1) {
        if (wantsDrag) {
          logWarn(
            table,
            'columnDragging: перетаскивание столбцов не работает при многоуровневой шапке (getHeaderGroups().length > 1) и отключено. См. ADR 0022.',
            'columnDragging:multi-level-header',
          )
        }
        return false
      }

      return wantsDrag
    }

    // Ключа `[_getVisibleLeafColumns(table)]` достаточно: `getVisibleLeafColumns`
    // мемоизирован TanStack на составе листовых колонок и их видимости (порядок
    // определения, НЕ пиннинг), а `getCanDrag` зависит от глубины шапки и флагов
    // включения, но НЕ от пиннинга. Значит смена пиннинга не меняет ни ключ, ни
    // значение индекса — залипания нет. Структурные правки колонок (в т.ч. глубина
    // шапки) меняют состав листьев → ключ инвалидируется штатно.
    _staticColumn.getDraggableIndex = memo(
      () => [_getVisibleLeafColumns(table)],
      columns =>
        columns
          .filter(column => column.getCanDrag())
          .findIndex(d => d.id === _staticColumn.id),
      getMemoOptions(table.options, 'debugColumns', 'getDraggableIndex'),
    )
  },
  // Кнопка перетаскивания объявлена декларативно в записи реестра
  // (`registry.ts`); здесь фича регистрирует обработчики dnd-событий.
  createTable: table => {
    const { onColumnDragStart, onColumnDragEnd } =
      getColumnDraggingEvents(table)

    table.setOptions({
      ...table.options,
      onColumnDragStart,
      onColumnDragEnd,
    })
  },
}
