/**
 * Кастомная фича columnDragging. Собственный слайс overlay-состояния
 * (columnDraggingActiveId) + его updater, и column-методы getCanDrag/getDraggableIndex.
 *  - getDraggableIndex считается напрямую (учитывает порядок листьев, не видимость —
 *    достаточно для dnd-индекса);
 *  - под вложенной шапкой перетаскиваются и группы (ADR 0052, узлы — ./nodes);
 *  - dnd-события живут в getColumnDraggingEvents (грид вызывает их), а не пекутся в
 *    options (v9 запрещает setOptions в constructTableAPIs);
 *  - срезы `columnMoves` (переносы в ожидании промиса) и `columnMoveFailed` (ключ
 *    вспышки отказа) — ADR 0114.
 */
import {
  assignPrototypeAPIs,
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type {
  RowData,
  Table,
  TableFeature,
  TableFeatures,
  Updater,
} from '../../types'
import type { ColumnMoveFailed, ColumnMoves } from './commitColumnMove'
import { announcerLabels } from '../../core/announcer'
import { mirrorFailures } from '../../core/failures/failuresFeature'
import { mirrorPending } from '../../shared/objectPending'
import { DEFAULT_LABELS } from '../../core/localization'
import { rejectionText } from '../../util/thenable'
import type { DragOverlayState } from './types'

interface ColumnDraggingStateSlice {
  columnDraggingActiveId: DragOverlayState
  columnMoves: ColumnMoves
  columnMoveFailed: ColumnMoveFailed
}
interface ColumnDraggingOptions {
  enableColumnDragging?: boolean
  columnDragRevertOnReject?: boolean
  onColumnDraggingActiveIdChange?: (updater: Updater<DragOverlayState>) => void
  onColumnMovesChange?: (updater: Updater<ColumnMoves>) => void
  onColumnMoveFailedChange?: (updater: Updater<ColumnMoveFailed>) => void
}
interface ColumnDraggingTableAPI {
  setColumnDraggingActiveId: (updater: Updater<DragOverlayState>) => void
  setColumnMoves: (updater: Updater<ColumnMoves>) => void
  setColumnMoveFailed: (updater: Updater<ColumnMoveFailed>) => void
}
interface ColumnDraggingColumnDef {
  enableDragging?: boolean
}
interface ColumnDraggingColumnAPI {
  getCanDrag: () => boolean
  getDraggableIndex: () => number
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
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
/* eslint-enable @typescript-eslint/no-unused-vars */

type DraggableColumn = {
  id: string
  columnDef: { enableDragging?: boolean }
  table: {
    options: { enableColumnDragging?: boolean }
    getHeaderGroups: () => unknown[]
    getAllLeafColumns: () => { id: string; getCanDrag: () => boolean }[]
  }
}

/** Колонка (лист или группа) перетаскиваема: флаг плагина и флаг её `columnDef`. */
const canDrag = (column: DraggableColumn): boolean =>
  !!column.columnDef.enableDragging &&
  !!column.table.options.enableColumnDragging

interface DraggableIndexCache {
  enabled: boolean
  depth: number
  byId: Map<string, number>
}

// Ключ — мемоизированный массив листьев TanStack: без кэша каждый заголовок заново
// фильтровал все колонки через getCanDrag (O(заголовков × колонок) на рендер шапки).
const draggableIndexCache = new WeakMap<object, DraggableIndexCache>()

const draggableIndexOf = (column: DraggableColumn): number => {
  const { table } = column
  const leaves = table.getAllLeafColumns()
  const enabled = !!table.options.enableColumnDragging
  const depth = table.getHeaderGroups().length
  let cached = draggableIndexCache.get(leaves)
  if (!cached || cached.enabled !== enabled || cached.depth !== depth) {
    const byId = new Map<string, number>()
    leaves
      .filter(leaf => leaf.getCanDrag())
      .forEach((leaf, index) => byId.set(leaf.id, index))
    cached = { enabled, depth, byId }
    draggableIndexCache.set(leaves, cached)
  }
  return cached.byId.get(column.id) ?? -1
}

const NO_MOVES: ColumnMoves = {}
const NO_FAILS: ColumnMoveFailed = {}

type SliceAtom<T> = { get: () => T; set: (value: T) => void }

/** Сеттер среза: обработчик опций, иначе атом напрямую. */
const sliceSetter =
  <T>(
    table: unknown,
    key: string,
    handler: string,
    onChange?: (prev: T, next: T) => void,
  ) =>
  (updater: Updater<T>) => {
    const own = (table as { options: Record<string, unknown> }).options[
      handler
    ] as ((u: Updater<T>) => void) | undefined
    const atom = (table as { atoms: Record<string, SliceAtom<T> | undefined> })
      .atoms[key]
    const prev = atom?.get()
    if (own) own(updater)
    else atom?.set(functionalUpdate(updater, atom.get()))
    if (onChange && atom && prev !== undefined) onChange(prev, atom.get())
  }

export const columnDraggingFeature: TableFeature = {
  getInitialState: state => ({
    columnDraggingActiveId: null,
    columnMoves: NO_MOVES,
    columnMoveFailed: NO_FAILS,
    ...state,
  }),
  getDefaultTableOptions: table => ({
    onColumnDraggingActiveIdChange: makeStateUpdater(
      'columnDraggingActiveId',
      table,
    ),
    onColumnMovesChange: makeStateUpdater('columnMoves', table),
    onColumnMoveFailedChange: makeStateUpdater('columnMoveFailed', table),
  }),
  constructTableAPIs: table => {
    // v9 useTable возвращает фасад с сырыми options (без фичевых defaults) — даём
    // метод-сеттер overlay-id, бьющий по внутреннему default-updater/атому.
    assignTableAPIs('columnDraggingFeature', table, {
      table_setColumnDraggingActiveId: {
        fn: (updater: Updater<DragOverlayState>) => {
          const opts = (table as Table<any, any>).options
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
      table_setColumnMoves: {
        fn: sliceSetter<ColumnMoves>(
          table,
          'columnMoves',
          'onColumnMovesChange',
          // Ожидание переноса — волна колонок узла, а не дуга ручки (ADR 0177, §1).
          (prev, next) =>
            mirrorPending(table, 'columnMove', prev, next, (_, move) =>
              move.leaves.map(column => ({ column })),
            ),
        ),
      },
      table_setColumnMoveFailed: {
        fn: sliceSetter<ColumnMoveFailed>(
          table,
          'columnMoveFailed',
          'onColumnMoveFailedChange',
          (prev, next) =>
            mirrorFailures(table, prev, next, (id, failed) => {
              const labels = announcerLabels(table) ?? DEFAULT_LABELS
              return {
                label: labels.moveColumn,
                target: { column: id },
                reason: rejectionText(failed.error) ?? labels.moveColumnFailed,
              }
            }),
        ),
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
        fn: (column: DraggableColumn) => draggableIndexOf(column),
      },
    })
  },
}
