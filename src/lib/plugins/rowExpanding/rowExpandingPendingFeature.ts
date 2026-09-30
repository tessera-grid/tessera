/**
 * Ожидание раскрытия (ADR 0041, §3): слайс `rowExpandPending` — строки, раскрытие
 * которых ждёт промиса `onExpandRow`, и row-метод `getIsExpandPending`. Значение —
 * номер попытки: поздний итог прежней попытки игнорируется.
 */
import {
  assignPrototypeAPIs,
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'

export type RowExpandPending = Record<string, number>

interface RowExpandPendingStateSlice {
  rowExpandPending: RowExpandPending
}
interface RowExpandPendingOptions {
  onRowExpandPendingChange?: (updater: Updater<RowExpandPending>) => void
}
interface RowExpandPendingRowAPI {
  getIsExpandPending: () => boolean
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
    })
  },
}
