/**
 * Методы таблицы серверной модели строк (ADR 0138, §7): приложение перезапрашивает окно и
 * меняет строку в кэше. Без серверного источника (плагин выключен) вызовы ничего не делают.
 */
import { assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import type { ServerSource } from './source'

export interface RefreshRowsOptions {
  /** Сразу скелет вместо строк на экране. */
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
}
