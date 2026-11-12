/**
 * `table.autosizeColumns(columnIds?)` (ADR 0217, §2): подогнать названные или все колонки данных
 * по содержимому. Автор зовёт его, когда сам обновил содержимое.
 */
import { assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../../types'
import { autosizeColumns } from './autosize'

interface ColumnAutosizeTableAPI {
  /** Подогнать ширину по содержимому; `true` — подогнана хоть одна колонка. */
  autosizeColumns: (columnIds?: readonly string[]) => Promise<boolean>
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    columnAutosizeFeature: TableFeature
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    columnAutosizeFeature: ColumnAutosizeTableAPI
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    columnAutosizeFeature: {
      /** Подгонка по содержимому на приходе данных (ADR 0217, §2). */
      autosizeOnData?: boolean
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export const columnAutosizeFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('columnAutosizeFeature', table, {
      table_autosizeColumns: {
        fn: (columnIds?: readonly string[]) =>
          autosizeColumns(table, columnIds, 'api'),
      },
    })
  },
}
