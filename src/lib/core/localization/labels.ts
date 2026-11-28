import type { LabelDictionary } from './resolveLabels'

/**
 * Labels of the table's controls. Any of them can be overridden through the DataGrid
 * `localization` prop — to translate or reword them.
 */
export interface TableLabels {
  /** Accessible name of the table (`aria-label` on `role="table"`) */
  table: string
  /** Accessible name of the top toolbar (`aria-label` on `role="toolbar"`) */
  toolbar: string
  /** Value of a boolean column cell for screen readers (ADR 0172, DT6) */
  booleanTrue: string
  booleanFalse: string
  /** Accessible name of the header actions kebab button (`aria-label`/tooltip) */
  headerMenu: string
  /** The "View settings" button (ADR 0215). */
  viewSettings: string
  /** The "View settings" button with active sections. */
  viewSettingsActive: (count: number) => string
  /** Short value of an inactive section. */
  viewSettingsNone: string
  /** Short value of a section: how many are enabled. */
  viewSettingsActiveCount: (count: number) => string
  /** Short value of a section: how many drafts (ADR 0178). */
  viewSettingsDraftCount: (count: number) => string
  /** Short value of a section that is simply enabled. */
  viewSettingsOn: string
  /** Accessible name of a section row: the name and the full value. */
  viewSettingsSectionName: (section: string, value: string) => string
  /** Hidden-column icon next to a level name: tooltip and accessible name. */
  viewSettingsHiddenColumn: string
  /** Hint of a level's dot (ADR 0224). */
  viewSettingsLevelHint: string
  /** Keyboard shortcut summary and its search (ADR 0232, KX17–KX19). */
  shortcuts: string
  shortcutsSearch: string
  shortcutsEmpty: string
  shortcutNavigation: string
  shortcutSelection: string
  shortcutEditing: string
  shortcutMoving: string
  shortcutMenu: string
  shortcutMoveCell: string
  shortcutCellEdge: string
  shortcutPage: string
  shortcutActionMode: string
  shortcutCmd: string
  shortcutCtrl: string
  shortcutOption: string
  shortcutAlt: string
  shortcutShiftApple: string
  shortcutShift: string
  /** Accessible name of the row actions kebab button (`aria-label`/tooltip) */
  rowMenu: string
  /** Accessible name of a kebab holding active actions (`count` is their number) */
  withActiveCount: (name: string, count: number) => string
  /** Announcement: a popover or menu module (`name` is the element's label) failed to load */
  loadFailed: (name: string) => string
  /** Description of a menu item whose availability is being checked (ADR 0078) */
  availabilityChecking: string
  /** Why an item is disabled when the availability check failed */
  availabilityCheckFailed: string
  /** Description of a menu item whose action is running */
  actionRunning: string
  /** Failure text of a menu action when the error carries none */
  actionFailedFallback: string
  /** Tooltip and description of a button with a failure mark (ADR 0127): `reason` is the reason text */
  actionFailedRetry: (reason: string) => string
  /** Kebab accessible name and tooltip: pending actions (`names` — their labels, comma-separated) */
  actionsRunning: (names: string) => string
  /** Kebab accessible name and tooltip: failed actions */
  actionsFailed: (names: string) => string
  /** Announcement: a menu action completed */
  announceActionDone: (name: string) => string
  /** Announcement: a menu action was rejected (`error` is the failure text) */
  announceActionFailed: (name: string, error: string) => string
  /** Name and tooltip of a busy button and a pending menu item: cancel the action (ADR 0153) */
  cancelAction: (name: string) => string
  /** Announcement: the action was cancelled */
  announceActionCancelled: (name: string) => string
  /** Cancel button in the pending alert of a server action */
  cancel: string
  /** Pending alert of a server action (ADR 0153, §5) */
  pendingSorting: string
  pendingFiltering: string
  pendingSearch: string
  pendingPage: string
  pendingGrouping: string
  /** Pending alert of a column summary change (ADR 0230, §7) */
  pendingAggregation: string
  pendingCopy: string
  pendingSelectPage: string
  pendingPaste: string
  pendingFill: string
  /** Undo and redo are waiting for server row model rows (ADR 0222, §7) */
  pendingUndo: string
  pendingRedo: string
  /** A cell write is waiting for the answer to the limit question (ADR 0223) */
  pendingWrite: string
  /** The write limit question and its buttons (ADR 0223, §2) */
  writeQuestion: (count: number) => string
  writeConfirm: string
  writeDecline: string
  /** Write limit refusal: more cells than the limit (ADR 0223, §2) */
  writeOverLimit: (count: number, max: number) => string
  /** The question before pasting, in place of the pending alert, and its buttons (ADR 0219, WR3) */
  pasteQuestionValue: (value: string) => string
  pasteQuestionCount: (count: number) => string
  pasteConfirm: string
  pasteDecline: string
  /** Pending alert of an action on the whole table: its name */
  pendingAction: (name: string) => string
  /** Server action name in the cancellation announcement (ADR 0153, §8) */
  actionSorting: string
  actionFiltering: string
  actionSearch: string
  actionPage: string
  actionGrouping: string
  /** Action: column summary (ADR 0230, §7) */
  actionAggregation: string
  actionCopy: string
  actionSelectPage: string
  actionPaste: string
  actionFill: string
  actionUndo: string
  actionRedo: string
  actionWrite: string
  /** Accessible name of the "back" row of a menu section (ADR 0079) */
  menuBack: (section: string) => string
  /** Announcement: a menu section opened */
  announceMenuSection: (section: string) => string
  /** A menu section row whose items failed to load */
  sectionLoadFailed: string
  /** Failure text of a cell save when the server sent none (ADR 0041) */
  saveFailed: string
  /** Accessible name of a cell error dot without an edit button (ADR 0150) */
  cellError: string
  /** Retry a rejected save in the cell mark popover (ADR 0177). */
  failureRetry: string
  /** Discard a rejected cell change (ADR 0177). */
  failureDiscard: string
  /** Button of an action with an unapplied draft (ADR 0178, §3). */
  actionDraft: (action: string) => string
  /** An active action that has an unapplied change. */
  actionActiveDraft: (action: string) => string
  /** Mark of an unsaved cell value: name and the "was, now" reason. */
  draftWas: string
  draftNow: string
  cellNotSaved: string
  /** Write target — a cell: the column and the row number. */
  failureTargetCell: (column: string, row: number) => string
  /** Write target — a row. */
  failureTargetRow: (row: number) => string
  /** Write target — the whole table's data request. */
  failureTargetTable: string
  /** A change to a busy object was not accepted: it is still saving (ADR 0177, OB6). */
  announceStillSaving: (name: string) => string
  /** Accessible name of the loading indicator and the first-load skeleton announcement */
  loading: string
  /** Sort change announcement: ascending, descending, sorting removed */
  announceSortAscending: (column: string) => string
  announceSortDescending: (column: string) => string
  announceSortCleared: string
  /** Announcement that loading finished (`rows` is the row count) */
  announceLoaded: (rows: number) => string
  /** Stub title and the empty-result announcement (ADR 0123) */
  noData: string
  /** Stub: there are no visible columns (ADR 0123) */
  noColumnsTitle: string
  /** Row count of a group next to its value (server grouping, ADR 0144) */
  groupRowCount: (count: number) => string
  /** Load-more error row (ADR 0081): text and the retry button */
  loadMoreRetry: string
  /** Error row of a failed server row model block (ADR 0138) */
  rowsLoadFailed: string
  /**
   * Data load error (ADR 0096): title of the refresh alert and the first-load stub, retry and
   * close buttons, announcements (`reason` is the reason, if any)
   */
  loadErrorTitle: string
  loadFailedTitle: string
  loadRetry: string
  loadErrorDismiss: string
  announceLoadError: string
  announceLoadErrorReason: (reason: string) => string
  announceLoadFailed: string
  announceLoadFailedReason: (reason: string) => string
  /** Failure reason of a server action by its kind, when the server sent none (ADR 0116) */
  serverActionFailedSorting: string
  serverActionFailedFiltering: string
  serverActionFailedSearch: string
  serverActionFailedPagination: string
  serverActionFailedGrouping: string
  /** The server refused a column summary change (ADR 0230, §7) */
  serverActionFailedAggregation: string
  serverActionFailedCopy: string
  serverActionFailedPaste: string
  serverActionFailedFill: string
  serverActionFailedUndo: string
  serverActionFailedRedo: string
  serverActionFailedWrite: string
  serverActionFailedSelectPage: string
  /** Announcement of the row count after a filter or search */
  announceFilteredRows: (count: number) => string
  /** Client row transaction announcement: rows added and removed (ADR 0199, §6) */
  announceRowsAdded: (count: number) => string
  announceRowsRemoved: (count: number) => string
  /** Action: the active cell moved */
  actionMoveActiveCell: string
  /** Action: entering a cell's action mode */
  actionEnterActionMode: string
  /** Action: leaving a cell's action mode */
  actionExitActionMode: string
  /** Action: highlight a row, cell or column */
  actionHighlight: string
  /** Action: remove a highlight */
  actionClearHighlights: string
  /** Action: an outcome flash on the target */
  actionFlashOutcome: string
  /** Action: a row transaction */
  actionRowTransaction: string
  /** Action: scroll to a row */
  actionScrollToRow: string
  /** Action: clear filters from the stub */
  actionResetFilters: string
  /** Action: retry loading data */
  actionRetryLoad: string
  /** Action: cancel the table's pending operations */
  actionCancelPending: string
  /** Action: open a menu */
  actionOpenMenu: string
  /** Action: close a menu */
  actionCloseMenu: string
  /** Action: open an action's panel */
  actionOpenPanel: string
  /** Action: enter a menu section */
  actionEnterSection: string
  /** Action: leave a menu section */
  actionLeaveSection: string
  /** Action: a server action request and its outcome */
  actionServerRequest: string
  /** Action: a pending request was replaced by a new one */
  actionServerReplaced: string
  /** Action: saving a cell value from a custom control (`trackCellAction`) */
  actionSave: string
}

/** Английский словарь подписей: строки-шаблоны с `{имя}` и формы слова `_one`, `_zero`. */
type DefaultLabels = Record<keyof TableLabels, string> & LabelDictionary

/**
 * English labels — the sample dictionary for the application (ADR 0132, §7). A key without a
 * suffix is the "other" plural form and the fallback for languages with other forms.
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
  viewSettingsLevelHint: 'In effect',
  shortcuts: 'Keyboard shortcuts',
  shortcutsSearch: 'Search actions',
  shortcutsEmpty: 'No shortcuts found',
  shortcutNavigation: 'Navigation',
  shortcutSelection: 'Selection',
  shortcutEditing: 'Editing',
  shortcutMoving: 'Reordering',
  shortcutMenu: 'Menus',
  shortcutMoveCell: 'Move one cell',
  shortcutCellEdge: 'First or last cell',
  shortcutPage: 'Previous or next page',
  shortcutActionMode: 'Enter action mode',
  shortcutCmd: '⌘',
  shortcutCtrl: 'Ctrl',
  shortcutOption: '⌥',
  shortcutAlt: 'Alt',
  shortcutShiftApple: '⇧',
  shortcutShift: 'Shift',
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
  pendingAggregation: 'Summarizing…',
  pendingCopy: 'Copying…',
  pendingSelectPage: 'Selecting the page…',
  pendingPaste: 'Pasting…',
  pendingFill: 'Filling…',
  pendingUndo: 'Undoing…',
  pendingRedo: 'Redoing…',
  pendingWrite: 'Changing cells…',
  writeQuestion: 'Change {count} cells?',
  writeQuestion_one: 'Change {count} cell?',
  writeConfirm: 'Change',
  writeDecline: "Don't change",
  writeOverLimit: '{count} cells — more than {max} at once',
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
  actionAggregation: 'Summary',
  actionCopy: 'Copying',
  actionSelectPage: 'Selecting the page',
  actionPaste: 'Pasting',
  actionFill: 'Filling',
  actionUndo: 'Undo',
  actionRedo: 'Redo',
  actionWrite: 'Changing cells',
  menuBack: 'Back, {section}',
  announceMenuSection: '{section} menu',
  sectionLoadFailed: "Couldn't load",
  saveFailed: "Couldn't save",
  cellError: 'Cell error',
  failureRetry: 'Retry',
  failureDiscard: 'Revert change',
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
  serverActionFailedAggregation: "Summary wasn't applied",
  serverActionFailedCopy: "The cells weren't copied",
  serverActionFailedPaste: "The cells weren't pasted",
  serverActionFailedFill: "The cells weren't filled",
  serverActionFailedUndo: "The change wasn't undone",
  serverActionFailedRedo: "The change wasn't redone",
  serverActionFailedWrite: "The cells weren't changed",
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
