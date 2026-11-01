import type { LabelDictionary } from './resolveLabels'

/**
 * Подписи элементов управления таблицы. Любую можно переопределить через
 * проп `localization` у DataGrid — для локализации или смены формулировок.
 */
export interface TableLabels {
  /** Имя и тултип кнопки раскрытия у свёрнутой строки (ADR 0015, RE13) */
  expandRow: string
  /** Имя и тултип кнопки раскрытия у раскрытой строки */
  collapseRow: string
  /** Имя и тултип кнопки в шапке колонки раскрытия, если есть свёрнутые строки (ADR 0160) */
  expandAll: string
  /** Имя и тултип той же кнопки, когда раскрыто всё */
  collapseAll: string
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
  /** Кнопка «Колонки», когда часть колонок скрыта (`hidden` — их число) */
  columnsWithHidden: (hidden: number) => string
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
  /** Ось «Строки»: с учётом перечисленного — список из `exportViewSorting` и `exportViewFiltering` */
  exportView: (features: string[]) => string
  exportViewSorting: string
  exportViewFiltering: string
  /** Ось «Строки»: текущая страница */
  exportPage: string
  /** Ось «Строки»: выбранные строки */
  exportSelected: string
  /** Ось «Строки» при бесконечной прокрутке без серверной выгрузки: загруженные строки (ADR 0081) */
  exportLoaded: (count: number) => string
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
  /** Кнопка панели фильтра в серверном режиме: отправить условие (ADR 0154) */
  filterApply: string
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
  /** Значение ячейки булевой колонки для скринридера (ADR 0172, DT6) */
  booleanTrue: string
  booleanFalse: string
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
  /** Доступное имя чекбокса выбора строки */
  selectRow: string
  /** Доступное имя чекбокса выбора всех строк */
  selectAll: string
  /** Доступное имя флажка строки-группы: выбрать группу целиком (ADR 0148) */
  selectGroup: string
  /** Доступное имя кебаб-кнопки меню действий заголовка (`aria-label`/тултип) */
  headerMenu: string
  /** Доступное имя кебаб-кнопки меню действий строки (`aria-label`/тултип) */
  rowMenu: string
  /** Доступное имя кебаба, в который свёрнуты включённые действия (`count` — их число) */
  withActiveCount: (name: string, count: number) => string
  /** Доступное имя контекстного меню (`aria-label` на `role="menu"`) */
  contextMenu: string
  /** Объявление: модуль поповера или меню (`name` — подпись элемента) не загрузился */
  loadFailed: (name: string) => string
  /** Описание пункта меню, чья доступность проверяется (ADR 0078) */
  availabilityChecking: string
  /** Причина блокировки пункта, если проверка доступности не удалась */
  availabilityCheckFailed: string
  /** Описание пункта меню, чьё действие выполняется */
  actionRunning: string
  /** Текст отказа действия меню, если ошибка его не несёт */
  actionFailedFallback: string
  /** Тултип и описание кнопки с отметкой отказа (ADR 0127): `reason` — текст причины */
  actionFailedRetry: (reason: string) => string
  /** Доступное имя и тултип кебаба: ждущие действия (`names` — их подписи через запятую) */
  actionsRunning: (names: string) => string
  /** Доступное имя и тултип кебаба: упавшие действия */
  actionsFailed: (names: string) => string
  /** Объявление: действие меню завершилось */
  announceActionDone: (name: string) => string
  /** Объявление: действие меню отклонено (`error` — текст отказа) */
  announceActionFailed: (name: string, error: string) => string
  /** Имя и тултип занятой кнопки и ждущего пункта меню: отмена действия (ADR 0153) */
  cancelAction: (name: string) => string
  /** Объявление: действие отменено */
  announceActionCancelled: (name: string) => string
  /** Кнопка отмены в плашке ожидания серверного действия */
  cancel: string
  /** Плашка ожидания серверного действия (ADR 0153, §5) */
  pendingSorting: string
  pendingFiltering: string
  pendingSearch: string
  pendingPage: string
  pendingGrouping: string
  pendingCopy: string
  /** Имя серверного действия в объявлении отмены (ADR 0153, §8) */
  actionSorting: string
  actionFiltering: string
  actionSearch: string
  actionPage: string
  actionGrouping: string
  actionCopy: string
  /** Доступное имя строки «назад» раздела меню (ADR 0079) */
  menuBack: (section: string) => string
  /** Объявление: открыт раздел меню */
  announceMenuSection: (section: string) => string
  /** Строка раздела меню, чьи пункты не загрузились */
  sectionLoadFailed: string
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
  /** Доступное имя точки ошибки ячейки без кнопки правки (ADR 0150) */
  cellError: string
  /** Объявление отказа сохранения ячейки (`column` — имя колонки) */
  announceSaveFailed: (column: string, error: string) => string
  /** Текст отказа загрузки детей строки, если сервер не прислал свой (ADR 0054) */
  loadChildrenFailed: string
  /** Объявление отказа раскрытия строки */
  announceExpandFailed: (error: string) => string
  /** Текст отказа переноса строки, если сервер не прислал свой (ADR 0112) */
  moveRowFailed: string
  /** Объявление отказа переноса строки */
  announceMoveFailed: (error: string) => string
  /** Текст отказа переноса колонки, если сервер не прислал свой (ADR 0114) */
  moveColumnFailed: string
  /** Объявление отказа переноса колонки */
  announceColumnMoveFailed: (error: string) => string
  /** Объявление асинхронного прихода детей строки (`0` — пустой ответ, ADR 0056) */
  announceChildrenLoaded: (count: number) => string
  /** Доступное имя индикатора загрузки и объявление скелета первой загрузки */
  loading: string
  /** Объявление смены сортировки: по возрастанию, по убыванию, сортировка снята */
  announceSortAscending: (column: string) => string
  announceSortDescending: (column: string) => string
  announceSortCleared: string
  /** Объявление числа выбранных строк */
  announceSelection: (count: number) => string
  /** Объявление копирования выделения (`cells` — число ячеек) */
  announceCopy: (cells: number) => string
  /** Объявление ожидания копирования: догружаются строки выделения (ADR 0146) */
  announceCopyLoading: (rows: number) => string
  /** Объявление транзакции строк серверной модели: строки добавлены (ADR 0157) */
  announceRowsAdded: (count: number) => string
  /** Объявление транзакции строк серверной модели: строки удалены (ADR 0157) */
  announceRowsRemoved: (count: number) => string
  /** Отказ копирования: строк выделения больше предела `maxCopyRows` (ADR 0146) */
  copyTooManyRows: (rows: number, max: number) => string
  /** Отказ копирования: браузер не дал записать в буфер обмена (ADR 0146) */
  copyClipboardDenied: string
  /** Объявление окончания загрузки (`rows` — число строк) */
  announceLoaded: (rows: number) => string
  /** Заголовок заглушки и объявление пустого результата (ADR 0123) */
  noData: string
  /** Заглушка: видимых колонок нет (ADR 0123) */
  noColumnsTitle: string
  /** Заглушка: все колонки скрыты (ADR 0123) */
  columnsHiddenTitle: string
  /** Скрытые подписи заголовков служебных колонок (`label` записи `ServiceColumn`) */
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
  /** Меню ручки строки в серверной модели: к краям списка (ADR 0159, §6) */
  moveToStart: string
  moveToEnd: string
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
  /** Диапазон строк страницы, когда итог неизвестен: «1–25 of many» (ADR 0158) */
  pageRangeOfMany: (from: number, to: number) => string
  /** Объявление смены страницы */
  pageAnnouncement: (page: number, pages: number) => string
  /** Объявление смены страницы, когда число страниц неизвестно */
  pageAnnouncementOfMany: (page: number) => string
  /** Счётчик загруженных строк в нижней панели (`infiniteScroll({ loadedCount })`): итог неизвестен и известен */
  loadedRows: (count: number) => string
  loadedRowsOf: (count: number, total: number) => string
  /** Короткие формы счётчиков в узкой нижней панели (ADR 0083, TX6); не обрезаются */
  loadedRowsShort: (count: number) => string
  loadedRowsOfShort: (count: number, total: number) => string
  selectedRowsShort: (count: number) => string
  selectedRowsHiddenShort: (count: number) => string
  filteredRowsShort: (shown: number, total: number) => string
  /** Число строк группы рядом с её значением (серверная группировка, ADR 0144) */
  groupRowCount: (count: number) => string
  /** Строка ошибки догрузки (ADR 0081): текст и кнопка повтора */
  loadMoreFailed: string
  loadMoreRetry: string
  /** Строка ошибки отказавшего блока серверной модели строк (ADR 0138) */
  rowsLoadFailed: string
  /**
   * Ошибка загрузки данных (ADR 0096): заголовок плашки обновления и заглушки первой
   * загрузки, кнопки повтора и закрытия, объявления (`reason` — причина, если есть)
   */
  loadErrorTitle: string
  loadFailedTitle: string
  loadRetry: string
  loadErrorDismiss: string
  announceLoadError: string
  announceLoadErrorReason: (reason: string) => string
  announceLoadFailed: string
  announceLoadFailedReason: (reason: string) => string
  /** Причина отказа серверного действия по его виду, если сервер не прислал свою (ADR 0116) */
  serverActionFailedSorting: string
  serverActionFailedFiltering: string
  serverActionFailedSearch: string
  serverActionFailedPagination: string
  serverActionFailedGrouping: string
  serverActionFailedCopy: string
  /** Кнопка «наверх» в нижней панели (ADR 0082): тултип и доступное имя */
  backToTop: string
  /** Кнопка «к первой колонке» в нижней панели (ADR 0105) */
  backToStart: string
  /** Объявление прихода блока догрузки */
  announceMoreLoaded: (count: number) => string
  /** Счётчик выбранных строк в нижней панели (`rowSelection({ selectedCount })`) */
  selectedRows: (count: number) => string
  /** «Выбрано всё, кроме k», когда строк данных в выборке не знает сервер (ADR 0144, §5) */
  selectedAllExcept: (count: number) => string
  selectedAllExceptShort: (count: number) => string
  /**
   * Выбраны группы без числа их строк (ADR 0148, §3): «12 строк и 2 группы»; `groups` —
   * подпись `selectedGroupsCount`, при нуле строк — только она
   */
  selectedRowsAndGroups: (count: number, groups: string) => string
  selectedRowsAndGroupsShort: (count: number, groups: string) => string
  selectedGroupsCount: (count: number) => string
  /** Ветки дерева, выбранные без числа их строк (ADR 0162, §4): «2 ветки» */
  selectedBranchesCount: (count: number) => string
  /** Добавка к счётчику выбранных: выбранные строки, скрытые фильтром (ADR 0045) */
  selectedRowsHidden: (count: number) => string
  /** Поле быстрого поиска в тулбаре (`quickSearch`): плейсхолдер и доступное имя */
  search: string
  /** Кнопка очистки быстрого поиска */
  clearSearch: string
  /** Подсказка поиска: подписи колонок, по которым он идёт (ADR 0053) */
  searchColumnsHint: (columns: string[]) => string
  /** Подсказка поиска, когда искать не по чему */
  searchNoColumns: string
  /**
   * Кнопка-сводка фильтров в тулбаре: тултип и доступное имя — без активных фильтров, с
   * активными (`count`) и с активными на скрытых колонках (`hidden`)
   */
  filters: string
  filtersActive: (count: number) => string
  filtersActiveHidden: (count: number, hidden: number) => string
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

/** Английский словарь подписей: строки-шаблоны с `{имя}` и формы слова `_one`, `_zero`. */
type DefaultLabels = Record<keyof TableLabels, string> & LabelDictionary

/**
 * Английские подписи — словарь-образец для приложения (ADR 0132, §7). Ключ без суффикса —
 * форма «остальные числа» и запасная для языка с другим набором форм.
 */
export const DEFAULT_LABELS = {
  expandRow: 'Expand row',
  collapseRow: 'Collapse row',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  pin: 'Pin column',
  unpin: 'Unpin column',
  pinLeft: 'Pin left',
  pinRight: 'Pin right',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  clearSort: 'Clear sorting',
  sortPriority: 'Sort priority {position} of {total}',
  group: 'Group',
  ungroup: 'Ungroup',
  table: 'Data table',
  toolbar: 'Table toolbar',
  columns: 'Columns',
  columnsWithHidden: 'Columns, {count} hidden',
  export: 'Export',
  exportRows: 'Rows',
  exportColumns: 'Columns',
  exportFormat: 'Format',
  exportPresets: 'Quick sets',
  exportRun: 'Export',
  exportColumnsVisible: 'Visible columns',
  exportColumnsAll: 'All columns',
  exportAll: 'All rows',
  exportView: 'With {features}',
  exportViewSorting: 'sorting',
  exportViewFiltering: 'filters',
  exportPage: 'Current page',
  exportSelected: 'Selected rows',
  exportLoaded: 'Loaded rows ({count})',
  filter: 'Filter',
  filterActive: 'Filter, active',
  filterCondition: 'Condition',
  filterValue: 'Value',
  filterFrom: 'From',
  filterTo: 'To',
  filterReset: 'Reset',
  filterApply: 'Apply',
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
  booleanTrue: 'Yes',
  booleanFalse: 'No',
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
  filterTimeFrom: 'Time from',
  filterTimeTo: 'Time to',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  filterAnyOf: 'Any of',
  filterAllOf: 'All of',
  filterNoneOf: 'None of',
  filterSearchOptions: 'Search values',
  filterSelectAll: 'Select all',
  filterClearSelection: 'Clear selection',
  filterNoOptions: 'No values',
  filterLoadingOptions: 'Loading…',
  filterOptionsError: "Couldn't load values",
  filterRetry: 'Retry',
  searchColumns: 'Find column',
  noColumnsFound: 'No columns found',
  showAllColumns: 'Show all',
  allColumns: 'All columns',
  selectedColumns: '{count} columns selected',
  selectedColumns_one: '{count} column selected',
  resetColumns: 'Reset',
  hideColumn: 'Hide column',
  hideGroup: 'Hide group',
  selectRow: 'Select row',
  selectAll: 'Select all rows',
  selectGroup: 'Select group',
  headerMenu: 'Column options',
  rowMenu: 'Row options',
  withActiveCount: '{name}, {count} active',
  contextMenu: 'Context menu',
  loadFailed: "Couldn't load {name}. Try again.",
  availabilityChecking: 'Checking availability',
  availabilityCheckFailed: "Couldn't check availability",
  actionRunning: 'In progress',
  actionFailedFallback: 'Something went wrong',
  actionFailedRetry: 'Failed: {reason}. Click to retry',
  actionsRunning: 'Running: {names}',
  actionsFailed: 'Failed: {names}',
  announceActionDone: '{name}: done',
  announceActionFailed: '{name} failed: {error}',
  cancelAction: 'Cancel: {name}',
  announceActionCancelled: '{name}: cancelled',
  cancel: 'Cancel',
  pendingSorting: 'Sorting…',
  pendingFiltering: 'Filtering…',
  pendingSearch: 'Searching…',
  pendingPage: 'Loading the page…',
  pendingGrouping: 'Grouping…',
  pendingCopy: 'Copying…',
  actionSorting: 'Sorting',
  actionFiltering: 'Filtering',
  actionSearch: 'Search',
  actionPage: 'Page loading',
  actionGrouping: 'Grouping',
  actionCopy: 'Copying',
  menuBack: 'Back, {section}',
  announceMenuSection: '{section} menu',
  sectionLoadFailed: "Couldn't load",
  copy: 'Copy',
  editCell: 'Edit cell',
  resizeColumn: 'Resize column',
  editCellValue: 'Edit {column}',
  saveFailed: "Couldn't save",
  cellError: 'Cell error',
  announceSaveFailed: '{column}: {error}',
  loadChildrenFailed: 'Unknown error',
  announceExpandFailed: "Couldn't load: {error}",
  moveRowFailed: 'Unknown error',
  announceMoveFailed: "Couldn't move row: {error}",
  moveColumnFailed: 'Unknown error',
  announceColumnMoveFailed: "Couldn't move column: {error}",
  announceChildrenLoaded: 'Loaded {count} rows',
  announceChildrenLoaded_one: 'Loaded {count} row',
  announceChildrenLoaded_zero: 'No rows',
  loading: 'Loading',
  announceSortAscending: 'Sorted by {column}, ascending',
  announceSortDescending: 'Sorted by {column}, descending',
  announceSortCleared: 'Sorting cleared',
  announceSelection: '{count} rows selected',
  announceSelection_one: '{count} row selected',
  announceCopy: 'Copied {count} cells',
  announceCopy_one: 'Copied {count} cell',
  announceCopyLoading: 'Copying: loading {count} rows',
  announceCopyLoading_one: 'Copying: loading {count} row',
  announceRowsAdded: 'Added {count} rows',
  announceRowsAdded_one: 'Added {count} row',
  announceRowsRemoved: 'Removed {count} rows',
  announceRowsRemoved_one: 'Removed {count} row',
  copyTooManyRows: 'The limit is {max} rows. Use export',
  copyClipboardDenied: "The browser didn't allow writing to the clipboard",
  announceLoaded: 'Loaded {count} rows',
  announceLoaded_one: 'Loaded {count} row',
  noData: 'No data',
  noColumnsTitle: 'No columns',
  columnsHiddenTitle: 'All columns are hidden',
  expandColumn: 'Expand',
  reorderColumn: 'Reorder',
  rowActionsColumn: 'Actions',
  moveColumn: 'Move column',
  moveRow: 'Move row',
  moveLeft: 'Move left',
  moveRight: 'Move right',
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveToStart: 'Move to start',
  moveToEnd: 'Move to end',
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
  pageRange: '{from}–{to} of {total}',
  pageRangeOfMany: '{from}–{to} of many',
  pageAnnouncement: 'Page {page} of {pages}',
  pageAnnouncementOfMany: 'Page {page}',
  loadedRows: 'Loaded {count}',
  loadedRowsOf: 'Loaded {count} of {total}',
  loadMoreFailed: "Couldn't load more rows",
  loadMoreRetry: 'Retry',
  rowsLoadFailed: "Couldn't load these rows",
  loadErrorTitle: "Couldn't refresh the data",
  loadFailedTitle: "Couldn't load the data",
  loadRetry: 'Retry',
  loadErrorDismiss: 'Dismiss',
  serverActionFailedSorting: "Sorting wasn't applied",
  serverActionFailedFiltering: "Filters weren't applied",
  serverActionFailedSearch: "Search wasn't applied",
  serverActionFailedPagination: "The page didn't change",
  serverActionFailedGrouping: "Grouping wasn't applied",
  serverActionFailedCopy: "The cells weren't copied",
  announceLoadError: "Couldn't refresh the data",
  announceLoadErrorReason: "Couldn't refresh the data: {reason}",
  announceLoadFailed: "Couldn't load the data",
  announceLoadFailedReason: "Couldn't load the data: {reason}",
  backToTop: 'Back to top',
  backToStart: 'Back to first column',
  announceMoreLoaded: 'Loaded {count} more rows',
  announceMoreLoaded_one: 'Loaded {count} more row',
  selectedRows: '{count} rows selected',
  selectedRows_one: '{count} row selected',
  selectedRowsHidden: '{count} hidden by filters',
  loadedRowsShort: '{count}',
  loadedRowsOfShort: '{count} / {total}',
  selectedRowsShort: '{count} selected',
  selectedAllExcept: 'All selected except {count}',
  selectedAllExcept_zero: 'All selected',
  selectedAllExceptShort: 'All except {count}',
  selectedAllExceptShort_zero: 'All',
  selectedRowsAndGroups: '{count} rows and {groups} selected',
  selectedRowsAndGroups_one: '{count} row and {groups} selected',
  selectedRowsAndGroups_zero: '{groups} selected',
  selectedRowsAndGroupsShort: '{count} + {groups}',
  selectedRowsAndGroupsShort_zero: '{groups}',
  selectedGroupsCount: '{count} groups',
  selectedGroupsCount_one: '{count} group',
  selectedBranchesCount: '{count} branches',
  selectedBranchesCount_one: '{count} branch',
  selectedRowsHiddenShort: '{count} hidden',
  filteredRowsShort: '{shown} / {total}',
  groupRowCount: '({count})',
  search: 'Search',
  clearSearch: 'Clear search',
  searchColumnsHint: 'Search in columns: {columns}',
  searchNoColumns: 'No columns to search',
  filters: 'Filters',
  filtersActive: 'Filters, {count} active',
  filtersActiveHidden: 'Filters, {count} active, {hidden} on hidden columns',
  removeFilter: 'Remove filter: {column}',
  noRowsMatchFilters: 'No rows match the filters',
  announceFilteredRows: '{count} rows',
  announceFilteredRows_one: '{count} row',
  resetFilters: 'Reset filters',
  columnHidden: 'column hidden',
  filteredRows: 'Showing {shown} of {total}',
} satisfies DefaultLabels
