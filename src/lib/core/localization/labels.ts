import type { LabelDictionary } from './resolveLabels'

/**
 * Подписи элементов управления таблицы. Любую можно переопределить через
 * проп `localization` у DataGrid — для локализации или смены формулировок.
 */
export interface TableLabels {
  /** Доступное имя таблицы (`aria-label` на `role="table"`) */
  table: string
  /** Доступное имя верхнего тулбара (`aria-label` на `role="toolbar"`) */
  toolbar: string
  /** Значение ячейки булевой колонки для скринридера (ADR 0172, DT6) */
  booleanTrue: string
  booleanFalse: string
  /** Доступное имя кебаб-кнопки меню действий заголовка (`aria-label`/тултип) */
  headerMenu: string
  /** Кнопка «Настройки вида» (ADR 0215). */
  viewSettings: string
  /** Кнопка «Настройки вида» с активными разделами. */
  viewSettingsActive: (count: number) => string
  /** Короткое значение неактивного раздела. */
  viewSettingsNone: string
  /** Короткое значение раздела: сколько включено. */
  viewSettingsActiveCount: (count: number) => string
  /** Короткое значение раздела: сколько черновиков (ADR 0178). */
  viewSettingsDraftCount: (count: number) => string
  /** Короткое значение раздела, который просто включён. */
  viewSettingsOn: string
  /** Доступное имя строки раздела: имя и полное значение. */
  viewSettingsSectionName: (section: string, value: string) => string
  /** Значок скрытой колонки у имени уровня: тултип и доступное имя. */
  viewSettingsHiddenColumn: string
  /** Доступное имя кебаб-кнопки меню действий строки (`aria-label`/тултип) */
  rowMenu: string
  /** Доступное имя кебаба, в который свёрнуты включённые действия (`count` — их число) */
  withActiveCount: (name: string, count: number) => string
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
  pendingSelectPage: string
  pendingPaste: string
  pendingFill: string
  /** Отмена и повтор ждут строк серверной модели (ADR 0222, §7) */
  pendingUndo: string
  pendingRedo: string
  /** Вопрос перед вставкой на месте плашки ожидания и его кнопки (ADR 0219, WR3) */
  pasteQuestionValue: (value: string) => string
  pasteQuestionCount: (count: number) => string
  pasteConfirm: string
  pasteDecline: string
  /** Плашка ожидания действия над всей таблицей: его имя */
  pendingAction: (name: string) => string
  /** Имя серверного действия в объявлении отмены (ADR 0153, §8) */
  actionSorting: string
  actionFiltering: string
  actionSearch: string
  actionPage: string
  actionGrouping: string
  actionCopy: string
  actionSelectPage: string
  actionPaste: string
  actionFill: string
  actionUndo: string
  actionRedo: string
  /** Доступное имя строки «назад» раздела меню (ADR 0079) */
  menuBack: (section: string) => string
  /** Объявление: открыт раздел меню */
  announceMenuSection: (section: string) => string
  /** Строка раздела меню, чьи пункты не загрузились */
  sectionLoadFailed: string
  /** Текст отказа сохранения ячейки, если сервер не прислал свой (ADR 0041) */
  saveFailed: string
  /** Доступное имя точки ошибки ячейки без кнопки правки (ADR 0150) */
  cellError: string
  /** Повтор отклонённого сохранения в поповере отметки ячейки (ADR 0177). */
  failureRetry: string
  /** Отбросить отклонённое изменение ячейки (ADR 0177). */
  failureDiscard: string
  /** Кнопка действия с неприменённым черновиком (ADR 0178, §3). */
  actionDraft: (action: string) => string
  /** Включённое действие, у которого есть неприменённое изменение. */
  actionActiveDraft: (action: string) => string
  /** Отметка несохранённого значения ячейки: имя и причина «было, стало». */
  draftWas: string
  draftNow: string
  cellNotSaved: string
  /** Цель записи — ячейка: колонка и номер строки. */
  failureTargetCell: (column: string, row: number) => string
  /** Цель записи — строка. */
  failureTargetRow: (row: number) => string
  /** Цель записи — запрос данных всей таблицы. */
  failureTargetTable: string
  /** Изменение занятого объекта не принято: он ещё сохраняется (ADR 0177, OB6). */
  announceStillSaving: (name: string) => string
  /** Доступное имя индикатора загрузки и объявление скелета первой загрузки */
  loading: string
  /** Объявление смены сортировки: по возрастанию, по убыванию, сортировка снята */
  announceSortAscending: (column: string) => string
  announceSortDescending: (column: string) => string
  announceSortCleared: string
  /** Объявление окончания загрузки (`rows` — число строк) */
  announceLoaded: (rows: number) => string
  /** Заголовок заглушки и объявление пустого результата (ADR 0123) */
  noData: string
  /** Заглушка: видимых колонок нет (ADR 0123) */
  noColumnsTitle: string
  /** Число строк группы рядом с её значением (серверная группировка, ADR 0144) */
  groupRowCount: (count: number) => string
  /** Строка ошибки догрузки (ADR 0081): текст и кнопка повтора */
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
  serverActionFailedPaste: string
  serverActionFailedFill: string
  serverActionFailedUndo: string
  serverActionFailedRedo: string
  serverActionFailedSelectPage: string
  /** Объявление числа строк после применения фильтра или поиска */
  announceFilteredRows: (count: number) => string
  /** Объявление клиентской транзакции строк: строки добавлены и удалены (ADR 0199, §6) */
  announceRowsAdded: (count: number) => string
  announceRowsRemoved: (count: number) => string
  /** Действие: переход активной ячейки */
  actionMoveActiveCell: string
  /** Действие: вход в режим действия ячейки */
  actionEnterActionMode: string
  /** Действие: выход из режима действия ячейки */
  actionExitActionMode: string
  /** Действие: подсветка строки, ячейки или колонки */
  actionHighlight: string
  /** Действие: снять подсветку */
  actionClearHighlights: string
  /** Действие: вспышка итога на цели */
  actionFlashOutcome: string
  /** Действие: транзакция строк */
  actionRowTransaction: string
  /** Действие: прокрутка к строке */
  actionScrollToRow: string
  /** Действие: сброс фильтров из заглушки */
  actionResetFilters: string
  /** Действие: повтор загрузки данных */
  actionRetryLoad: string
  /** Действие: отмена ожидающих операций таблицы */
  actionCancelPending: string
  /** Действие: открыть меню */
  actionOpenMenu: string
  /** Действие: закрыть меню */
  actionCloseMenu: string
  /** Действие: открыть панель действия */
  actionOpenPanel: string
  /** Действие: войти в раздел меню */
  actionEnterSection: string
  /** Действие: выйти из раздела меню */
  actionLeaveSection: string
  /** Действие: запрос серверного действия и его итог */
  actionServerRequest: string
  /** Действие: ждущий запрос заменён новым */
  actionServerReplaced: string
  /** Действие: сохранение значения ячейки из своего контрола (`trackCellAction`) */
  actionSave: string
}

/** Английский словарь подписей: строки-шаблоны с `{имя}` и формы слова `_one`, `_zero`. */
type DefaultLabels = Record<keyof TableLabels, string> & LabelDictionary

/**
 * Английские подписи — словарь-образец для приложения (ADR 0132, §7). Ключ без суффикса —
 * форма «остальные числа» и запасная для языка с другим набором форм.
 */
export const DEFAULT_LABELS = {
  table: 'Data table',
  toolbar: 'Table toolbar',
  booleanTrue: 'Yes',
  booleanFalse: 'No',
  headerMenu: 'Column options',
  viewSettings: 'View settings',
  viewSettingsActive: 'View settings, {count} active',
  viewSettingsActive_one: 'View settings, {count} active',
  viewSettingsNone: 'none',
  viewSettingsActiveCount: '{count} active',
  viewSettingsDraftCount: '{count} drafts',
  viewSettingsDraftCount_one: '{count} draft',
  viewSettingsOn: 'active',
  viewSettingsSectionName: '{section}: {value}',
  viewSettingsHiddenColumn: 'Column hidden',
  rowMenu: 'Row options',
  withActiveCount: '{name}, {count} active',
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
  pendingSelectPage: 'Selecting the page…',
  pendingPaste: 'Pasting…',
  pendingFill: 'Filling…',
  pendingUndo: 'Undoing…',
  pendingRedo: 'Redoing…',
  pasteQuestionValue: 'Paste "{value}"?',
  pasteQuestionCount: 'Paste {count} values?',
  pasteQuestionCount_one: 'Paste {count} value?',
  pasteConfirm: 'Paste',
  pasteDecline: "Don't paste",
  pendingAction: '{name}…',
  actionSorting: 'Sorting',
  actionFiltering: 'Filtering',
  actionSearch: 'Search',
  actionPage: 'Page loading',
  actionGrouping: 'Grouping',
  actionCopy: 'Copying',
  actionSelectPage: 'Selecting the page',
  actionPaste: 'Pasting',
  actionFill: 'Filling',
  actionUndo: 'Undo',
  actionRedo: 'Redo',
  menuBack: 'Back, {section}',
  announceMenuSection: '{section} menu',
  sectionLoadFailed: "Couldn't load",
  saveFailed: "Couldn't save",
  cellError: 'Cell error',
  failureRetry: 'Retry',
  failureDiscard: 'Discard change',
  actionDraft: '{action}, not applied',
  actionActiveDraft: '{action}, a change is not applied',
  draftWas: 'Was',
  draftNow: 'Now',
  cellNotSaved: 'Not saved',
  failureTargetCell: '{column} · row {row}',
  failureTargetRow: 'Row {row}',
  failureTargetTable: 'Table',
  announceStillSaving: '{name} is still saving — the change was not applied',
  loading: 'Loading',
  announceSortAscending: 'Sorted by {column}, ascending',
  announceSortDescending: 'Sorted by {column}, descending',
  announceSortCleared: 'Sorting cleared',
  announceLoaded: 'Loaded {count} rows',
  announceLoaded_one: 'Loaded {count} row',
  noData: 'No data',
  noColumnsTitle: 'No columns',
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
  serverActionFailedPaste: "The cells weren't pasted",
  serverActionFailedFill: "The cells weren't filled",
  serverActionFailedUndo: "The change wasn't undone",
  serverActionFailedRedo: "The change wasn't redone",
  serverActionFailedSelectPage: "The page rows weren't selected",
  announceLoadError: "Couldn't refresh the data",
  announceLoadErrorReason: "Couldn't refresh the data: {reason}",
  announceLoadFailed: "Couldn't load the data",
  announceLoadFailedReason: "Couldn't load the data: {reason}",
  groupRowCount: '({count})',
  announceFilteredRows: '{count} rows',
  announceFilteredRows_one: '{count} row',
  announceRowsAdded: 'Added {count} rows',
  announceRowsAdded_one: 'Added {count} row',
  announceRowsRemoved: 'Removed {count} rows',
  announceRowsRemoved_one: 'Removed {count} row',
  actionMoveActiveCell: 'Move the active cell',
  actionEnterActionMode: 'Enter action mode',
  actionExitActionMode: 'Exit action mode',
  actionHighlight: 'Highlight',
  actionClearHighlights: 'Clear highlights',
  actionFlashOutcome: 'Show the outcome',
  actionRowTransaction: 'Change rows',
  actionScrollToRow: 'Scroll to a row',
  actionResetFilters: 'Reset filters',
  actionRetryLoad: 'Load again',
  actionCancelPending: 'Cancel pending operations',
  actionOpenMenu: 'Open the menu',
  actionCloseMenu: 'Close the menu',
  actionOpenPanel: 'Open the panel',
  actionEnterSection: 'Open a menu section',
  actionLeaveSection: 'Back to the menu',
  actionServerRequest: 'Request to the server',
  actionServerReplaced: 'Request replaced',
  actionSave: 'Save',
} satisfies DefaultLabels
