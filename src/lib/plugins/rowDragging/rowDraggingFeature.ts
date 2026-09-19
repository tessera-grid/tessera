/**
 * Кастомная фича rowDragging. Слайс overlay-состояния `rowDragging` + updater и
 * row-метод getCanDrag с гейтами (ADR 0022): многоуровневая шапка, активная
 * группировка, активная сортировка — всё гасит drag. grouping/sorting читаются из
 * атомов (optional — фичи могут отсутствовать); dev-warn'ы — TODO (логгер).
 */
import {
  assignPrototypeAPIs,
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import {
  DEFAULT_ROW_DRAG_OVERLAY_STATE,
  type RowDragOverlayState,
} from './types'

interface RowDraggingStateSlice {
  rowDragging: RowDragOverlayState
}
interface RowDraggingOptions {
  enableRowDragging?: boolean | ((row: unknown) => boolean)
  onRowDraggingChange?: (updater: Updater<RowDragOverlayState>) => void
}
interface RowDraggingRowAPI {
  getCanDrag: () => boolean
}
interface RowDraggingTableAPI {
  setRowDragging: (updater: Updater<RowDragOverlayState>) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    rowDraggingFeature: TableFeature
  }
  interface TableState_FeatureMap {
    rowDraggingFeature: RowDraggingStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowDraggingFeature: RowDraggingOptions
  }
  interface Row_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowDraggingFeature: RowDraggingRowAPI
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowDraggingFeature: RowDraggingTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

type DraggableRow = {
  table: {
    options: { enableRowDragging?: boolean | ((row: unknown) => boolean) }
    getHeaderGroups: () => unknown[]
    atoms: {
      grouping?: { get: () => unknown[] }
      sorting?: { get: () => unknown[] }
    }
  }
}

const canDragRow = (row: DraggableRow): boolean => {
  const enable = row.table.options.enableRowDragging
  const wantsDrag = typeof enable === 'function' ? enable(row) : !!enable

  if (!wantsDrag) {
    return false
  }
  // Многоуровневая шапка / активная группировка / активная сортировка гасят drag
  // (ADR 0022). TODO(логгер): dev-warn на каждый случай.
  if (row.table.getHeaderGroups().length !== 1) {
    return false
  }
  if ((row.table.atoms.grouping?.get() ?? []).length > 0) {
    return false
  }
  if ((row.table.atoms.sorting?.get() ?? []).length > 0) {
    return false
  }

  return true
}

export const rowDraggingFeature: TableFeature = {
  getInitialState: state => ({
    rowDragging: DEFAULT_ROW_DRAG_OVERLAY_STATE,
    ...state,
  }),
  getDefaultTableOptions: table => ({
    onRowDraggingChange: makeStateUpdater('rowDragging', table),
  }),
  constructTableAPIs: table => {
    // v9 useTable возвращает фасад с сырыми options (без фичевых defaults), поэтому
    // grid-редьюсер не может звать table.options.onRowDraggingChange напрямую —
    // даём метод-сеттер, который бьёт по ВНУТРЕННЕму (default) updater/атому.
    assignTableAPIs('rowDraggingFeature', table, {
      table_setRowDragging: {
        fn: (updater: Updater<RowDragOverlayState>) => {
          const opts = table.options as {
            onRowDraggingChange?: (u: Updater<RowDragOverlayState>) => void
          }
          if (opts.onRowDraggingChange) {
            opts.onRowDraggingChange(updater)
            return
          }
          // Фолбэк: пишем атом напрямую (если default по какой-то причине отсутствует).
          const atom = (
            table as unknown as {
              atoms: {
                rowDragging: {
                  get: () => RowDragOverlayState
                  set: (v: RowDragOverlayState) => void
                }
              }
            }
          ).atoms.rowDragging
          atom.set(functionalUpdate(updater, atom.get()))
        },
      },
    })
  },
  assignRowPrototype: (prototype, table) => {
    assignPrototypeAPIs('rowDraggingFeature', prototype, table, {
      row_getCanDrag: {
        fn: (row: DraggableRow) => canDragRow(row),
      },
    })
  },
}
