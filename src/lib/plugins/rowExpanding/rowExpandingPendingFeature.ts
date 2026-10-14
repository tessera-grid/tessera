/**
 * Ожидание раскрытия (ADR 0041, §3): слайс `rowExpandPending` — строки, раскрытие
 * которых ждёт промиса `onExpandRow`, и row-метод `getIsExpandPending`. Значение —
 * номер попытки: поздний итог прежней попытки игнорируется. Row-метод
 * `setExpandedByUser` — путь клика для других плагинов (раскрытие паузой, ADR 0109),
 * `getIsLazyParent` — признак ленивого родителя для переноса строк (ADR 0112).
 */
import {
  assignPrototypeAPIs,
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type {
  Row,
  RowData,
  TableFeature,
  TableFeatures,
  Updater,
} from '../../types'
import { readPluginHooks } from '../../core/definePlugin'
import { readLoadedChildren } from './lazyChildrenFeature'
import { isLazyRow, toggleRowExpanded } from './toggleRowExpanded'
import type { RowExpandingHooks } from './types'

export type RowExpandPending = Record<string, number>

interface RowExpandPendingStateSlice {
  rowExpandPending: RowExpandPending
}
interface RowExpandPendingOptions {
  onRowExpandPendingChange?: (updater: Updater<RowExpandPending>) => void
}
interface RowExpandPendingRowAPI {
  getIsExpandPending: () => boolean
  /**
   * Раскрыть или свернуть строку путём клика по шеврону: `onExpandRow`, `loadChildren`,
   * ожидание. Для плагинов, которые раскрывают строку без импорта rowExpanding.
   */
  setExpandedByUser: (expanded: boolean) => void
  /** Дети строки — ответ `loadChildren`, а не `subRows` данных (ADR 0054). */
  getIsLazyParent: () => boolean
}
interface RowExpandPendingTableAPI {
  setRowExpandPending: (updater: Updater<RowExpandPending>) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    rowExpandingPendingFeature: TableFeature
  }
  interface TableState_FeatureMap {
    rowExpandingPendingFeature: RowExpandPendingStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowExpandingPendingFeature: RowExpandPendingOptions
  }
  interface Row_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowExpandingPendingFeature: RowExpandPendingRowAPI
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowExpandingPendingFeature: RowExpandPendingTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

type PendingAtom = {
  get: () => RowExpandPending
  set: (value: RowExpandPending) => void
}

type PendingTable = { atoms: { rowExpandPending?: PendingAtom } }

const EMPTY: RowExpandPending = {}

const hasOwnSubRows = (row: Row<any, any>) =>
  !!(
    row.table.options as {
      getSubRows?: (row: unknown, index: number) => unknown[] | undefined
    }
  ).getSubRows?.(row.original, row.index)?.length

export const rowExpandingPendingFeature: TableFeature = {
  getInitialState: state => ({ rowExpandPending: EMPTY, ...state }),
  getDefaultTableOptions: table => ({
    onRowExpandPendingChange: makeStateUpdater('rowExpandPending', table),
  }),
  constructTableAPIs: table => {
    assignTableAPIs('rowExpandingPendingFeature', table, {
      table_setRowExpandPending: {
        fn: (updater: Updater<RowExpandPending>) => {
          const opts = table.options as RowExpandPendingOptions
          if (opts.onRowExpandPendingChange) {
            opts.onRowExpandPendingChange(updater)
            return
          }
          const atom = (table as unknown as PendingTable).atoms.rowExpandPending
          atom?.set(functionalUpdate(updater, atom.get()))
        },
      },
    })
  },
  assignRowPrototype: (prototype, table) => {
    assignPrototypeAPIs('rowExpandingPendingFeature', prototype, table, {
      row_getIsExpandPending: {
        fn: (row: { id: string; table: PendingTable }) =>
          !!row.table.atoms.rowExpandPending?.get()[row.id],
      },
      row_setExpandedByUser: {
        fn: (row: Row<any, any>, expanded: boolean) => {
          if (row.getIsExpanded() !== expanded) {
            toggleRowExpanded(
              row,
              readPluginHooks<Partial<RowExpandingHooks>>(
                row.table as never,
                'rowExpanding',
              ),
            )
          }
        },
      },
      row_getIsLazyParent: {
        fn: (row: Row<any, any>) =>
          !hasOwnSubRows(row) &&
          (row.id in readLoadedChildren(row.table) ||
            isLazyRow(
              row,
              readPluginHooks<Partial<RowExpandingHooks>>(
                row.table as never,
                'rowExpanding',
              ).hasChildren,
            )),
      },
    })
  },
}
