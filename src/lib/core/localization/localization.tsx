import { ReactNode, createContext, useContext, useMemo } from 'react'

/**
 * Подписи элементов управления таблицы. Любую можно переопределить через
 * проп `localization` у DataGrid — для локализации или смены формулировок.
 */
export interface TableLabels {
  /**
   * Имя и тултип кнопки раскрытия строки — одно в обоих состояниях: состояние несёт
   * `aria-expanded` кнопки (ADR 0015, RE13).
   */
  toggleRow: string
  /** Тултип кнопки закрепления колонки */
  pin: string
  /** Тултип кнопки открепления колонки */
  unpin: string
  /** Пункт меню / тумблер «закрепить слева» */
  pinLeft: string
  /** Пункт меню / тумблер «закрепить справа» */
  pinRight: string
  /** Тултип «сортировать по возрастанию» */
  sortAscending: string
  /** Тултип «сортировать по убыванию» */
  sortDescending: string
  /** Тултип «сбросить сортировку» */
  clearSort: string
  /**
   * Доступное имя приоритета столбца в мультисортировке (`position` из `total`,
   * 1-based). Уходит в `aria-label` кнопки — числовой бейдж приоритета скринридер
   * не читает, поэтому порядок сортировки проговаривается тут.
   */
  sortPriority: (position: number, total: number) => string
  /** Тултип кнопки группировки */
  group: string
  /** Тултип кнопки разгруппировки */
  ungroup: string
  /** Доступное имя таблицы (`aria-label` на `role="table"`) */
  table: string
  /** Доступное имя верхнего тулбара (`aria-label` на `role="toolbar"`) */
  toolbar: string
  /** Кнопка тулбара и доступное имя меню колонок (`columnVisibility`) */
  columns: string
  /** Кнопка тулбара «Экспорт» (`export`) */
  export: string
  /** Заголовок оси «Строки» панели экспорта */
  exportRows: string
  /** Заголовок оси «Колонки» панели экспорта */
  exportColumns: string
  /** Заголовок оси «Формат» панели экспорта */
  exportFormat: string
  /** Доступное имя ряда быстрых наборов панели экспорта */
  exportPresets: string
  /** Кнопка «Выгрузить» в панели экспорта */
  exportRun: string
  /** Ось «Строки»: весь `data` в исходном порядке */
  exportAll: string
  /** Ось «Строки»: с учётом перечисленного (сортировка, фильтры) */
  exportView: (features: ('sorting' | 'filtering')[]) => string
  /** Ось «Строки»: текущая страница */
  exportPage: string
  /** Ось «Строки»: выбранные строки */
  exportSelected: string
  /** Ось «Колонки»: видимые колонки */
  exportColumnsVisible: string
  /** Ось «Колонки»: все колонки, включая скрытые */
  exportColumnsAll: string
  /** Кнопка фильтра в заголовке и подпись панели фильтра (`columnFiltering`) */
  filter: string
  /** Доступное имя кнопки фильтра при активном фильтре колонки */
  filterActive: string
  /** Поле выбора условия в панели фильтра */
  filterCondition: string
  /** Поле значения в панели фильтра */
  filterValue: string
  /** Нижняя граница условия «между» */
  filterFrom: string
  /** Верхняя граница условия «между» */
  filterTo: string
  /** Кнопка сброса фильтра колонки */
  filterReset: string
  /** Ошибка поля числа: ввод не разбирается как число */
  filterInvalidNumber: string
  filterContains: string
  filterEquals: string
  filterNotEquals: string
  filterStartsWith: string
  filterEndsWith: string
  filterLessThan: string
  filterLessThanOrEqual: string
  filterGreaterThan: string
  filterGreaterThanOrEqual: string
  filterBetween: string
  filterEmpty: string
  filterNotEmpty: string
  /** Булев фильтр: без фильтра */
  filterAll: string
  filterYes: string
  filterNo: string
  /** Фильтр дат (ADR 0047): условия, пресеты, поле времени, листание месяцев */
  filterOn: string
  filterBefore: string
  filterAfter: string
  filterPreset: string
  filterPresetToday: string
  filterPresetYesterday: string
  filterPresetLast7Days: string
  filterPresetLast30Days: string
  filterPresetThisMonth: string
  filterPresetThisYear: string
  filterTime: string
  filterTimeFrom: string
  filterTimeTo: string
  previousMonth: string
  nextMonth: string
  /** Фильтр вариантов (ADR 0048): условия, чек-лист, загрузка справочника */
  filterAnyOf: string
  filterAllOf: string
  filterNoneOf: string
  filterSearchOptions: string
  filterSelectAll: string
  filterClearSelection: string
  filterNoOptions: string
  filterLoadingOptions: string
  filterOptionsError: string
  filterRetry: string
  /** Плейсхолдер и доступное имя поиска в меню колонок */
  searchColumns: string
  /** Текст меню колонок, когда поиск ничего не нашёл */
  noColumnsFound: string
  /** Кнопка «показать все колонки» в меню колонок */
  showAllColumns: string
  /** Кнопка сброса видимости колонок к начальной */
  resetColumns: string
  /** Пункт кебаба заголовка: скрыть колонку */
  hideColumn: string
  /** Пункт кебаба заголовка группы вложенной шапки: скрыть группу */
  hideGroup: string
  /** Доступное имя чекбокса выбора строки */
  selectRow: string
  /** Доступное имя чекбокса выбора всех строк */
  selectAll: string
  /** Доступное имя кебаб-кнопки меню действий заголовка (`aria-label`/тултип) */
  headerMenu: string
  /** Доступное имя контекстного меню (`aria-label` на `role="menu"`) */
  contextMenu: string
  /** Пункт «Копировать» (контекстное меню / действия выделения) */
  copy: string
  /** Тултип и доступное имя кнопки правки ячейки (`cellEditing`) */
  editCell: string
  /** Доступное имя ручки изменения ширины колонки (`role="separator"`) */
  resizeColumn: string
  /** Доступное имя поля встроенного редактора ячейки (`column` — имя колонки) */
  editCellValue: (column: string) => string
  /** Текст отказа сохранения ячейки, если сервер не прислал свой (ADR 0041) */
  saveFailed: string
  /** Объявление отказа сохранения ячейки (`column` — имя колонки) */
  announceSaveFailed: (column: string, error: string) => string
  /** Доступное имя индикатора загрузки и объявление скелета первой загрузки */
  loading: string
  /** Объявление смены сортировки (`column: null` — сортировка сброшена) */
  announceSort: (
    column: string | null,
    direction: 'ascending' | 'descending' | null,
  ) => string
  /** Объявление числа выбранных строк */
  announceSelection: (count: number) => string
  /** Объявление копирования выделения (`cells` — число ячеек) */
  announceCopy: (cells: number) => string
  /** Объявление окончания загрузки (`rows` — число строк) */
  announceLoaded: (rows: number) => string
  /** Объявление пустого результата */
  noData: string
  /** Скрытые подписи заголовков служебных колонок (`columnDef.serviceLabel`) */
  expandColumn: string
  reorderColumn: string
  rowActionsColumn: string
  /** Доступные имена ручек перетаскивания — кнопок меню перестановки */
  moveColumn: string
  moveRow: string
  /** Пункты меню ручки колонки */
  moveLeft: string
  moveRight: string
  /** Пункты меню ручки строки; `indentRow` / `outdentRow` — вложить в группу выше / вынести из группы */
  moveUp: string
  moveDown: string
  indentRow: string
  outdentRow: string
  /** Меню грипа ширины: имя меню и пункты */
  columnWidth: string
  widenColumn: string
  narrowColumn: string
  resetColumnWidth: string
  /** Доступное имя контрола пагинации (`aria-label` на `role="navigation"`) */
  pagination: string
  /** Видимая метка выбора размера страницы */
  rowsPerPage: string
  /** Кнопки пагинации: тултипы и доступные имена */
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  /** Диапазон строк текущей страницы: «1–25 of 1000» */
  pageRange: (from: number, to: number, total: number) => string
  /** Объявление смены страницы */
  pageAnnouncement: (page: number, pages: number) => string
  /** Счётчик выбранных строк в нижней панели (`rowSelection({ selectedCount })`) */
  selectedRows: (count: number) => string
  /** Добавка к счётчику выбранных: выбранные строки, скрытые фильтром (ADR 0045) */
  selectedRowsHidden: (count: number) => string
  /** Поле быстрого поиска в тулбаре (`quickSearch`): плейсхолдер и доступное имя */
  search: string
  /** Кнопка очистки быстрого поиска */
  clearSearch: string
  /** Кнопка-сводка фильтров в тулбаре: тултип и доступное имя с числами */
  filters: (active: number, hidden: number) => string
  /** Кнопка сброса одного фильтра в сводке */
  removeFilter: (column: string) => string
  /** Заглушка пустого результата фильтрации */
  noRowsMatchFilters: string
  /** Объявление числа строк после применения фильтра или поиска */
  announceFilteredRows: (count: number) => string
  /** Сброс всех фильтров (сводка, заглушка пустого результата) */
  resetFilters: string
  /** Пометка фильтра на скрытой колонке в сводке */
  columnHidden: string
  /** «Показано N из M» в нижней панели */
  filteredRows: (shown: number, total: number) => string
}

export const DEFAULT_LABELS: TableLabels = {
  toggleRow: 'Toggle row',
  pin: 'Pin column',
  unpin: 'Unpin column',
  pinLeft: 'Pin left',
  pinRight: 'Pin right',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  clearSort: 'Clear sorting',
  sortPriority: (position, total) => `Sort priority ${position} of ${total}`,
  group: 'Group',
  ungroup: 'Ungroup',
  table: 'Data table',
  toolbar: 'Table toolbar',
  columns: 'Columns',
  export: 'Export',
  exportRows: 'Rows',
  exportColumns: 'Columns',
  exportFormat: 'Format',
  exportPresets: 'Quick sets',
  exportRun: 'Export',
  exportColumnsVisible: 'Visible columns',
  exportColumnsAll: 'All columns',
  exportAll: 'All data',
  exportView: features => `With ${features.join(' and ')}`,
  exportPage: 'Current page',
  exportSelected: 'Selected rows',
  filter: 'Filter',
  filterActive: 'Filter, active',
  filterCondition: 'Condition',
  filterValue: 'Value',
  filterFrom: 'From',
  filterTo: 'To',
  filterReset: 'Reset',
  filterInvalidNumber: 'Enter a number',
  filterContains: 'Contains',
  filterEquals: 'Equals',
  filterNotEquals: 'Does not equal',
  filterStartsWith: 'Starts with',
  filterEndsWith: 'Ends with',
  filterLessThan: 'Less than',
  filterLessThanOrEqual: 'Less than or equal to',
  filterGreaterThan: 'Greater than',
  filterGreaterThanOrEqual: 'Greater than or equal to',
  filterBetween: 'Between',
  filterEmpty: 'Is empty',
  filterNotEmpty: 'Is not empty',
  filterAll: 'All',
  filterYes: 'Yes',
  filterNo: 'No',
  filterOn: 'On',
  filterBefore: 'Before',
  filterAfter: 'After',
  filterPreset: 'Period',
  filterPresetToday: 'Today',
  filterPresetYesterday: 'Yesterday',
  filterPresetLast7Days: 'Last 7 days',
  filterPresetLast30Days: 'Last 30 days',
  filterPresetThisMonth: 'This month',
  filterPresetThisYear: 'This year',
  filterTime: 'Time',
  filterTimeFrom: 'Start time',
  filterTimeTo: 'End time',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  filterAnyOf: 'Any of',
  filterAllOf: 'Has all of',
  filterNoneOf: 'None of',
  filterSearchOptions: 'Search values',
  filterSelectAll: 'Select all',
  filterClearSelection: 'Clear',
  filterNoOptions: 'No values',
  filterLoadingOptions: 'Loading…',
  filterOptionsError: 'Could not load values',
  filterRetry: 'Retry',
  searchColumns: 'Search columns',
  noColumnsFound: 'No columns found',
  showAllColumns: 'Show all',
  resetColumns: 'Reset',
  hideColumn: 'Hide column',
  hideGroup: 'Hide group',
  selectRow: 'Select row',
  selectAll: 'Select all rows',
  headerMenu: 'Column options',
  contextMenu: 'Context menu',
  copy: 'Copy',
  editCell: 'Edit cell',
  resizeColumn: 'Resize column',
  editCellValue: column => `Edit ${column}`,
  saveFailed: "Couldn't save",
  announceSaveFailed: (column, error) => `${column}: ${error}`,
  loading: 'Loading',
  announceSort: (column, direction) =>
    column ? `Sorted by ${column}, ${direction}` : 'Sorting cleared',
  announceSelection: count =>
    count === 1 ? '1 row selected' : `${count} rows selected`,
  announceCopy: cells =>
    cells === 1 ? 'Copied 1 cell' : `Copied ${cells} cells`,
  announceLoaded: rows => (rows === 1 ? 'Loaded 1 row' : `Loaded ${rows} rows`),
  noData: 'No data',
  expandColumn: 'Expand',
  reorderColumn: 'Reorder',
  rowActionsColumn: 'Actions',
  moveColumn: 'Move column',
  moveRow: 'Move row',
  moveLeft: 'Move left',
  moveRight: 'Move right',
  moveUp: 'Move up',
  moveDown: 'Move down',
  indentRow: 'Indent',
  outdentRow: 'Outdent',
  columnWidth: 'Column width',
  widenColumn: 'Wider',
  narrowColumn: 'Narrower',
  resetColumnWidth: 'Reset width',
  pagination: 'Pagination',
  rowsPerPage: 'Rows per page',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  pageRange: (from, to, total) => `${from}–${to} of ${total}`,
  pageAnnouncement: (page, pages) => `Page ${page} of ${pages}`,
  selectedRows: count =>
    count === 1 ? '1 row selected' : `${count} rows selected`,
  selectedRowsHidden: count => `${count} hidden by filters`,
  search: 'Search',
  clearSearch: 'Clear search',
  filters: (active, hidden) =>
    active === 0
      ? 'Filters'
      : `Filters, ${active} active` +
        (hidden > 0 ? `, ${hidden} on hidden columns` : ''),
  removeFilter: column => `Remove filter: ${column}`,
  noRowsMatchFilters: 'No rows match the filters',
  announceFilteredRows: count => (count === 1 ? '1 row' : `${count} rows`),
  resetFilters: 'Reset filters',
  columnHidden: 'column hidden',
  filteredRows: (shown, total) => `Showing ${shown} of ${total}`,
}

const LocalizationContext = createContext<TableLabels>(DEFAULT_LABELS)

/**
 * Возвращает текущие подписи (дефолтные или переопределённые через DataGrid).
 */
export const useLocalization = (): TableLabels =>
  useContext(LocalizationContext)

export interface LocalizationProviderProps {
  localization?: Partial<TableLabels>
  children: ReactNode
}

export const LocalizationProvider = ({
  localization,
  children,
}: LocalizationProviderProps) => {
  const value = useMemo(
    () =>
      localization ? { ...DEFAULT_LABELS, ...localization } : DEFAULT_LABELS,
    [localization],
  )

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  )
}
