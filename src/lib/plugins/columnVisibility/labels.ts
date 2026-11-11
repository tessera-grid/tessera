/** Подписи `columnVisibility` (ADR 0182, §8): ключи словаря таблицы `columnVisibility.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnVisibilityLabels {
  /** Кнопка тулбара и доступное имя меню колонок (`columnVisibility`) */
  columns: string
  /** Короткое значение раздела «Колонки» «Настроек вида»: ничего не скрыто (ADR 0215) */
  columnsAllVisible: string
  /** Короткое значение раздела «Колонки» «Настроек вида»: сколько колонок скрыто */
  columnsHiddenShort: (count: number) => string
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
  /** Действие: снять сортировку, фильтр и группировку скрытой колонки (ADR 0204, HT4) */
  actionClearTransforms: string
  /** Пункт скрытой колонки в доступном имени (ADR 0204, HT3) */
  hiddenColumn: string
  /** Подсказка у пункта только что скрытой колонки: преобразования (`list`) остаются */
  transformsKept: (list: readonly string[], count: number) => string
  /** Подсказка пункта кебаба «Скрыть колонку»: преобразования останутся */
  transformsWillRemain: (list: readonly string[], count: number) => string
  /** Тултип кнопки-ластика у скрытой колонки: что с ней сейчас (`transforms`) и что сделает нажатие */
  activeTransforms: (transforms: string) => string
  /** Объявление: колонки (`columns`) скрыты, их преобразования (`list`) остаются */
  columnsHiddenKept: (
    columns: readonly string[],
    list: readonly string[],
    count: number,
  ) => string
}

export const columnVisibilityLabels = defineLabels<ColumnVisibilityLabels>()(
  'columnVisibility',
  {
    columns: 'Columns',
    columnsAllVisible: 'all visible',
    columnsHiddenShort: '{count} hidden',
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
    actionClearTransforms: 'Clear sorting, filter and grouping of a column',
    hiddenColumn: 'hidden',
    transformsKept: '{list} remain',
    transformsKept_one: '{list} remains',
    transformsWillRemain: '{list} will remain',
    activeTransforms: '{transforms}. Click to clear',
    columnsHiddenKept: '{columns} hidden, {list} remain',
    columnsHiddenKept_one: '{columns} hidden, {list} remains',
  },
  {
    columnsHiddenShort: ['count'],
    selectedColumns: ['count'],
    transformsKept: ['list', 'count'],
    transformsWillRemain: ['list', 'count'],
    activeTransforms: ['transforms'],
    columnsHiddenKept: ['columns', 'list', 'count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnVisibility: typeof columnVisibilityLabels
  }
}
