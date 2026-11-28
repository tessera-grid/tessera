/**
 * Методы таблицы серверной модели строк (ADR 0138, §7): приложение перезапрашивает окно и
 * меняет строку в кэше. Без серверного источника (плагин выключен) вызовы ничего не делают.
 */
import { assignPrototypeAPIs, assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import type { ServerSource } from './source'

export interface RefreshRowsOptions {
  /** Show a skeleton instead of the rows on screen right away. */
  purge?: boolean
}

interface ServerRowModelTableAPI<TData> {
  /** Перезапросить строки окна; без `purge` строки на экране до ответа. */
  refreshRows: (options?: RefreshRowsOptions) => void
  /** Заменить данные загруженной строки; незагруженная — вызов игнорируется. */
  setRowData: (id: string, updater: Updater<TData>) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    serverRowModelFeature: TableFeature
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    serverRowModelFeature: ServerRowModelTableAPI<TData>
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const serverSource = (table: unknown) =>
  (table as { getRowSource: () => Partial<ServerSource> }).getRowSource()

export const serverRowModelFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('serverRowModelFeature', table, {
      table_refreshRows: {
        fn: (options?: RefreshRowsOptions) =>
          serverSource(table).refresh?.(options),
      },
      table_setRowData: {
        fn: (id: string, updater: Updater<unknown>) =>
          serverSource(table).setRowData?.(id, updater),
      },
    })
  },
  // Родитель строки ветки — из источника: в модели TanStack строк серверной модели нет, и
  // стоковый `getRow` бросил бы (ADR 0159).
  assignRowPrototype: (prototype, table) => {
    assignPrototypeAPIs('serverRowModelFeature', prototype, table, {
      row_getParentRow: {
        fn: (row: { parentId?: string | null; table: unknown }) =>
          row.parentId == null
            ? undefined
            : (
                row.table as {
                  getRowSource: () => { byId: (id: string) => unknown }
                }
              )
                .getRowSource()
                .byId(row.parentId),
      },
    })
  },
}
