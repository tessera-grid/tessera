/**
 * Кастомная фича columnDragging. Собственный слайс overlay-состояния
 * (columnDraggingActiveId) + его updater, и column-методы getCanDrag/getDraggableIndex.
 *  - getDraggableIndex считается напрямую (учитывает порядок листьев, не видимость —
 *    достаточно для dnd-индекса);
 *  - dev-warn многоуровневой шапки — TODO (логгер);
 *  - dnd-события живут в getColumnDraggingEvents (грид вызывает их), а не пекутся в
 *    options (v9 запрещает setOptions в constructTableAPIs).
 */
import {
  assignPrototypeAPIs,
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import type { DragOverlayState } from './types'

interface ColumnDraggingStateSlice {
  columnDraggingActiveId: DragOverlayState
}
interface ColumnDraggingOptions {
  enableColumnDragging?: boolean
  onColumnDraggingActiveIdChange?: (updater: Updater<DragOverlayState>) => void
}
interface ColumnDraggingTableAPI {
  setColumnDraggingActiveId: (updater: Updater<DragOverlayState>) => void
}
interface ColumnDraggingColumnDef {
  enableDragging?: boolean
}
interface ColumnDraggingColumnAPI {
  getCanDrag: () => boolean
  getDraggableIndex: () => number
}

declare module '@tanstack/react-table' {
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
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    columnDraggingFeature: ColumnDraggingTableAPI
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
    !!column.columnDef.enableDragging &&
    !!column.table.options.enableColumnDragging

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
    onColumnDraggingActiveIdChange: makeStateUpdater(
      'columnDraggingActiveId',
      table,
    ),
  }),
  constructTableAPIs: table => {
    // v9 useTable возвращает фасад с сырыми options (без фичевых defaults) — даём
    // метод-сеттер overlay-id, бьющий по внутреннему default-updater/атому.
    assignTableAPIs('columnDraggingFeature', table, {
      table_setColumnDraggingActiveId: {
        fn: (updater: Updater<DragOverlayState>) => {
          const opts = table.options as {
            onColumnDraggingActiveIdChange?: (
              u: Updater<DragOverlayState>,
            ) => void
          }
          if (opts.onColumnDraggingActiveIdChange) {
            opts.onColumnDraggingActiveIdChange(updater)
            return
          }
          const atom = (
            table as unknown as {
              atoms: {
                columnDraggingActiveId: {
                  get: () => DragOverlayState
                  set: (v: DragOverlayState) => void
                }
              }
            }
          ).atoms.columnDraggingActiveId
          atom.set(functionalUpdate(updater, atom.get()))
        },
      },
    })
  },
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
