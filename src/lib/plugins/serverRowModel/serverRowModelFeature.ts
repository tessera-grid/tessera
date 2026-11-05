/**
 * Методы таблицы серверной модели строк (ADR 0138, §7): приложение перезапрашивает окно и
 * меняет строку в кэше. Без серверного источника (плагин выключен) вызовы ничего не делают.
 */
import { assignPrototypeAPIs, assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import { logWarn } from '../../util/logger'
import type { ServerSource } from './source'
import type { ServerRowTransaction, ServerRowTransactionResult } from './types'

export interface RefreshRowsOptions {
  /** Сразу скелет вместо строк на экране. */
  purge?: boolean
}

interface ServerRowModelTableAPI<TData> {
  /** Перезапросить строки окна; без `purge` строки на экране до ответа. */
  refreshRows: (options?: RefreshRowsOptions) => void
  /** Заменить данные загруженной строки; незагруженная — вызов игнорируется. */
  setRowData: (id: string, updater: Updater<TData>) => void
  /**
   * Добавить, обновить и удалить строки без перезапроса (ADR 0157); в клиентском режиме —
   * `undefined` и предупреждение.
   */
  applyRowTransaction: (
    transaction: ServerRowTransaction<TData>,
  ) => ServerRowTransactionResult | undefined
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
      table_applyRowTransaction: {
        fn: (transaction: ServerRowTransaction) => {
          const apply = serverSource(table).applyRowTransaction
          if (apply) return apply(transaction)
          // В клиентском режиме данные у приложения: оно меняет `data` само (ADR 0157).
          logWarn(
            table as never,
            'applyRowTransaction works only with the server row model: change data instead',
            'serverRowModel:clientTransaction',
          )
          return undefined
        },
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
