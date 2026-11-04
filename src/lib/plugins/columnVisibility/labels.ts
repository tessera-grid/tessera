/** Подписи `columnVisibility` (ADR 0182, §8): ключи словаря таблицы `columnVisibility.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnVisibilityLabels {
  /** Кнопка тулбара и доступное имя меню колонок (`columnVisibility`) */
  columns: string
  /** Кнопка «Колонки», когда часть колонок скрыта (`hidden` — их число) */
  columnsWithHidden: (hidden: number) => string
  /** Плейсхолдер и доступное имя поиска в меню колонок */
  searchColumns: string
  /** Текст меню колонок, когда поиск ничего не нашёл */
  noColumnsFound: string
  /** Кнопка заглушки «все колонки скрыты»: показать все колонки */
  showAllColumns: string
  /** Флажок-корень дерева меню колонок: показать или скрыть все */
  allColumns: string
  /** Подвал меню колонок: сколько колонок видно */
  selectedColumns: (count: number) => string
  /** Кнопка сброса видимости колонок к начальной */
  resetColumns: string
  /** Пункт кебаба заголовка: скрыть колонку */
  hideColumn: string
  /** Пункт кебаба заголовка группы вложенной шапки: скрыть группу */
  hideGroup: string
  /** Заглушка: все колонки скрыты (ADR 0123) */
  columnsHiddenTitle: string
  /** Действие: показать или скрыть колонку */
  actionToggleColumn: string
}

export const columnVisibilityLabels = defineLabels<ColumnVisibilityLabels>()(
  'columnVisibility',
  {
    columns: 'Columns',
    columnsWithHidden: 'Columns, {count} hidden',
    searchColumns: 'Find column',
    noColumnsFound: 'No columns found',
    showAllColumns: 'Show all',
    allColumns: 'All columns',
    selectedColumns: '{count} columns selected',
    selectedColumns_one: '{count} column selected',
    resetColumns: 'Reset',
    hideColumn: 'Hide column',
    hideGroup: 'Hide group',
    columnsHiddenTitle: 'All columns are hidden',
    actionToggleColumn: 'Show or hide a column',
  },
  {
    columnsWithHidden: ['count'],
    selectedColumns: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnVisibility: typeof columnVisibilityLabels
  }
}
