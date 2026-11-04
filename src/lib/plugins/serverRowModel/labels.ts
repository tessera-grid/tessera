/** Подписи `serverRowModel` (ADR 0182, §8): ключи словаря таблицы `serverRowModel.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ServerRowModelLabels {
  /** Объявление транзакции строк серверной модели: строки добавлены (ADR 0157) */
  announceRowsAdded: (count: number) => string
  /** Объявление транзакции строк серверной модели: строки удалены (ADR 0157) */
  announceRowsRemoved: (count: number) => string
  /** Действие: загрузить блок строк */
  actionLoadBlock: string
  /** Действие: транзакция строк */
  actionRowTransaction: string
}

export const serverRowModelLabels = defineLabels<ServerRowModelLabels>()(
  'serverRowModel',
  {
    announceRowsAdded: 'Added {count} rows',
    announceRowsAdded_one: 'Added {count} row',
    announceRowsRemoved: 'Removed {count} rows',
    announceRowsRemoved_one: 'Removed {count} row',
    actionLoadBlock: 'Load rows',
    actionRowTransaction: 'Change rows',
  },
  {
    announceRowsAdded: ['count'],
    announceRowsRemoved: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    serverRowModel: typeof serverRowModelLabels
  }
}
