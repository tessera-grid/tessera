/**
 * Фаза E — кастомная v9-фича columnDragging (первая после commonFeature).
 *
 * Порт v8-плагина: собственный слайс overlay-состояния (columnDraggingActiveId) +
 * его updater, и column-методы getCanDrag/getDraggableIndex. Отличия:
 *  - getInitialState/getDefaultOptions → getInitialState/getDefaultTableOptions;
 *    updater — через makeStateUpdater (в v8 был самописный stateUpdater);
 *  - createColumn → assignColumnPrototype (методы через this-объект);
 *  - getDraggableIndex считается напрямую (в v9 нет `_getVisibleLeafColumns`/
 *    `getMemoOptions`); учитывает порядок листьев, не видимость — достаточно для
 *    dnd-индекса (перф-мемоизация — при необходимости позже);
 *  - dev-warn многоуровневой шапки — TODO (логгер), поведение сохранено;
 *  - dnd-события живут в getColumnDraggingEvents (грид вызывает на cutover), а не
 *    пекутся в options (v9 запрещает setOptions в constructTableAPIs).
 */
import { assignPrototypeAPIs, makeStateUpdater } from '@tanstack/table-v9'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import type { DragOverlayState } from './types'

interface ColumnDraggingStateSlice {
  columnDraggingActiveId: DragOverlayState
}
interface ColumnDraggingOptions {
  enableColumnDragging?: boolean
  onColumnDraggingActiveIdChange?: (updater: Updater<DragOverlayState>) => void
}
interface ColumnDraggingColumnDef {
  enableDragging?: boolean
}
interface ColumnDraggingColumnAPI {
  getCanDrag: () => boolean
  getDraggableIndex: () => number
}

declare module '@tanstack/table-v9' {
  interface Plugins {
    columnDraggingFeature: TableFeature
  }
  interface TableState_FeatureMap {
    columnDraggingFeature: ColumnDraggingStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    columnDraggingFeature: ColumnDraggingOptions
  }
  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    in out TValue,
  > {
    columnDraggingFeature: ColumnDraggingColumnDef
  }
  interface Column_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    columnDraggingFeature: ColumnDraggingColumnAPI
  }
}

type DraggableColumn = {
  id: string
  columnDef: { enableDragging?: boolean }
  table: {
    options: { enableColumnDragging?: boolean }
    getHeaderGroups: () => unknown[]
    getAllLeafColumns: () => { id: string; getCanDrag: () => boolean }[]
  }
}

const canDrag = (column: DraggableColumn): boolean => {
  const wantsDrag =
    !!column.columnDef.enableDragging && !!column.table.options.enableColumnDragging

  // Многоуровневая шапка гасит перетаскивание столбцов (ADR 0022).
  // TODO(логгер): dev-warn при wantsDrag под вложенной шапкой.
  if (column.table.getHeaderGroups().length !== 1) {
    return false
  }

  return wantsDrag
}

export const columnDraggingFeature: TableFeature = {
  getInitialState: state => ({
    columnDraggingActiveId: null,
    ...state,
  }),
  getDefaultTableOptions: table => ({
    onColumnDraggingActiveIdChange: makeStateUpdater('columnDraggingActiveId', table),
  }),
  assignColumnPrototype: (prototype, table) => {
    assignPrototypeAPIs('columnDraggingFeature', prototype, table, {
      column_getCanDrag: {
        fn: (column: DraggableColumn) => canDrag(column),
      },
      column_getDraggableIndex: {
        // Индекс среди перетаскиваемых листьев (порядок определения листьев).
        fn: (column: DraggableColumn) =>
          column.table
            .getAllLeafColumns()
            .filter(leaf => leaf.getCanDrag())
            .findIndex(leaf => leaf.id === column.id),
      },
    })
  },
}
