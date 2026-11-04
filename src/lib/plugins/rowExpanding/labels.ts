/** Подписи `rowExpanding` (ADR 0182, §8): ключи словаря таблицы `rowExpanding.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowExpandingLabels {
  /** Имя и тултип кнопки раскрытия у свёрнутой строки (ADR 0015, RE13) */
  expandRow: string
  /** Имя и тултип кнопки раскрытия у раскрытой строки */
  collapseRow: string
  /** Имя и тултип кнопки в шапке колонки раскрытия, если есть свёрнутые строки (ADR 0160) */
  expandAll: string
  /** Имя и тултип той же кнопки, когда раскрыто всё */
  collapseAll: string
  /** Текст отказа загрузки детей строки, если сервер не прислал свой (ADR 0054) */
  loadChildrenFailed: string
  /** Объявление отказа раскрытия строки */
  announceExpandFailed: (error: string) => string
  /** Объявление асинхронного прихода детей строки (`0` — пустой ответ, ADR 0056) */
  announceChildrenLoaded: (count: number) => string
  /** Скрытые подписи заголовков служебных колонок (`label` записи `ServiceColumn`) */
  expandColumn: string
  /** Действие: раскрыть или свернуть строку */
  actionToggleRow: string
}

export const rowExpandingLabels = defineLabels<RowExpandingLabels>()(
  'rowExpanding',
  {
    expandRow: 'Expand row',
    collapseRow: 'Collapse row',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    loadChildrenFailed: 'Unknown error',
    announceExpandFailed: "Couldn't load: {error}",
    announceChildrenLoaded: 'Loaded {count} rows',
    announceChildrenLoaded_one: 'Loaded {count} row',
    announceChildrenLoaded_zero: 'No rows',
    expandColumn: 'Expand',
    actionToggleRow: 'Expand or collapse a row',
  },
  {
    announceExpandFailed: ['error'],
    announceChildrenLoaded: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowExpanding: typeof rowExpandingLabels
  }
}
