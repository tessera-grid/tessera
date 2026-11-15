import type { InputType } from 'storybook/internal/csf'

import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../../../lib/plugins/rowActions'
import { DEFAULT_HEADER_ACTION_MENU } from '../../../../lib/plugins/headerActionMenu'
import { DEFAULT_ROW_ACTION_MENU } from '../../../../lib/plugins/rowActionMenu'
import { DEFAULT_FILTER_DEBOUNCE_MS } from '../../../../lib/plugins/columnFilteringModel/conditions'
import { DEFAULT_SEARCH_DEBOUNCE_MS } from '../../../../lib/plugins/quickSearchModel/search'
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZES,
} from '../../../../lib/plugins/pagination/registry'
import { DEFAULT_MAX_EXPANDING_DEPTH } from '../../../../lib/plugins/rowExpanding/registry'
import { DEFAULT_ROW_DRAG_EXPAND_DELAY } from '../../../../lib/plugins/rowDragging/getRowDraggingEvents'
import { DEFAULT_SKELETON_OPTIONS } from '../../../../lib/core/skeletonOptions'
import { DEFAULT_REFRESH_OPTIONS } from '../../../../lib/core/loadingDisplay'
import { DEFAULT_COLUMN } from '../../../../lib/core/defaultColumn'
import {
  DEFAULT_ROW_HEIGHT,
  MIN_HEADER_HEIGHT,
  MIN_ROW_HEIGHT,
} from '../../../../lib/core/rowHeights'
import { COLUMN_COUNT, DATA_COUNT } from '../../DataGridStory.types'

/** Умолчания настроек-данных фильтров и поиска — те же, что у фабрик. */
export const DEFAULT_COLUMN_FILTERING_OPTIONS = {
  debounceMs: DEFAULT_FILTER_DEBOUNCE_MS,
  filteredCount: false,
}
export const DEFAULT_QUICK_SEARCH_OPTIONS = {
  debounceMs: DEFAULT_SEARCH_DEBOUNCE_MS,
  filteredCount: false,
}

const numberControl = (
  description: string,
  range: { min: number; max: number; step: number },
  defaultSummary: string,
): InputType => ({
  control: { type: 'number', ...range },
  description,
  table: { defaultValue: { summary: defaultSummary } },
})

/**
 * Размер текстом (ADR 0117, SN9): числовой контрол Storybook пустого значения не
 * принимает. Пусто — умолчание, число — пиксели, иное — CSS-значение.
 */
const sizeControl = (
  description: string,
  defaultSummary: string,
): InputType => ({
  control: 'text',
  description,
  table: { defaultValue: { summary: defaultSummary } },
})

const booleanControl = (
  description: string,
  defaultValue = false,
): InputType => ({
  control: 'boolean',
  description,
  table: { defaultValue: { summary: String(defaultValue) } },
})

const radioControl = (
  description: string,
  options: (string | boolean)[],
  defaultSummary: string,
): InputType => ({
  control: 'inline-radio',
  options,
  description,
  table: { defaultValue: { summary: defaultSummary } },
})

/** Пояс дат таблицы (ADR 0169, §5). */
export const timeZoneType: InputType = {
  control: 'text',
  description:
    'Time zone for dates in the table, IANA (`timeZone`): used by the date filter and export; defaults to the browser time zone',
}

/** Режим данных (ADR 0169): одна радиокнопка на все операции. */
export const dataModeType = radioControl(
  'Where row operations run (`dataMode`): `server` — the table changes its state and calls the callbacks but does not reorder or narrow the rows; the story has no server',
  ['client', 'server'],
  'client',
)

const objectControl = (
  description: string,
  typeSummary: string,
  defaultValue: object,
): InputType => ({
  control: 'object',
  description,
  table: {
    type: { summary: typeSummary },
    defaultValue: { summary: JSON.stringify(defaultValue) },
  },
})

/**
 * Флаг панели вне скролла (ADR 0046): «auto» — по наличию слотов плагинов, «on» —
 * всегда, «off» — никогда.
 */
const panelFlag = (description: string): InputType => ({
  control: 'inline-radio',
  options: ['auto', 'on', 'off'],
  mapping: { auto: undefined, on: true, off: false },
  description,
  table: { defaultValue: { summary: 'auto' } },
})

/** Раскладывает контролы истории по группе (и подгруппе) панели Controls. */
export const inCategory = <T extends Record<string, InputType>>(
  category: string,
  types: T,
  subcategory?: string,
): T =>
  Object.fromEntries(
    Object.entries(types).map(([name, type]) => [
      name,
      { ...type, table: { ...type.table, category, subcategory } },
    ]),
  ) as T

// --- Данные и размеры ---------------------------------------------------------

export const columnCountType = numberControl(
  'Number of columns',
  { min: 0, max: 1000, step: 5 },
  String(COLUMN_COUNT),
)
export const dataCountType = numberControl(
  'Number of rows',
  { min: 0, max: 100_000, step: 10 },
  String(DATA_COUNT),
)
export const dataNestingType = radioControl(
  'Nested rows: flat — none, nested — child rows under every 10th row (visible when row expanding is on)',
  ['flat', 'nested'],
  'flat',
)
/** Язык подписей задаёт переключатель Language в тулбаре: в панели Controls его нет. */
export const localeType: InputType = { table: { disable: true } }
export const heightType = sizeControl('Table height', '100%')
export const maxHeightType = sizeControl('Maximum table height', '100%')
export const containerSizeType = sizeControl(
  'Height of the table container',
  'fits content',
)
export const expandAllType = booleanControl(
  'Expand all rows (`expanded: true`); turning it off collapses them all; applies on the fly',
)
export const showStubType = booleanControl(
  'Empty data: the table shows the no-data placeholder',
)
export const rowHeightType = numberControl(
  `Row height, minimum ${MIN_ROW_HEIGHT}px`,
  { min: MIN_ROW_HEIGHT, max: 120, step: 2 },
  String(DEFAULT_ROW_HEIGHT),
)
export const headerHeightType = numberControl(
  `Height of a column header row, minimum ${MIN_HEADER_HEIGHT}px`,
  { min: MIN_HEADER_HEIGHT, max: 120, step: 2 },
  'same as a row',
)
export const defaultColumnType = objectControl(
  'Default column width',
  '{ size?: number; minSize?: number; maxSize?: number }',
  { size: 150, ...DEFAULT_COLUMN },
)
export const headerNestingType = radioControl(
  'Column header nesting: flat — a single row, nested — column groups',
  ['flat', 'nested'],
  'flat',
)

// --- Ядро: панели и состояния -------------------------------------------------

/**
 * Загрузка (ADR 0106): `off` — нет, `initial` — скелет первой загрузки, `refresh` —
 * свечение обновления. В Controls это строка радио, до истории `mapping` доносит `false`.
 */
export const loadingType: InputType = {
  control: 'inline-radio',
  options: ['off', 'initial', 'refresh'],
  mapping: { off: false },
  description:
    'Data loading (`loading`): `initial` — the first-load skeleton, `refresh` — a glow under the column header and a dimmed body (ADR 0094)',
  table: { defaultValue: { summary: 'false' } },
}
export const skeletonOptionsType = objectControl(
  'rowsCount — rows: a number or `auto` (by height); columnsCount — columns, only when the table has no columns of its own',
  'SkeletonOptions',
  DEFAULT_SKELETON_OPTIONS,
)
/** Повышенный контраст (ADR 0088): по системе, всегда или никогда. */
export const contrastType: InputType = {
  control: 'inline-radio',
  options: ['auto', 'more', 'standard'],
  description:
    'Increased contrast (`contrast`): `auto` — follows `prefers-contrast: more`, `more` — always, `standard` — never',
  table: { defaultValue: { summary: 'auto' } },
}
export const refreshOptionsType = objectControl(
  'Refresh display: `delayMs` — delay, `minDurationMs` — minimum display time, ms',
  'RefreshOptions',
  DEFAULT_REFRESH_OPTIONS,
)
export const enableFooterType = booleanControl('Column footer')
/** Положение футера (ADR 0118): у низа области или за последней строкой. */
export const footerPositionType: InputType = {
  control: 'inline-radio',
  options: ['pinned', 'inline'],
  description:
    'Footer position (`footerPosition`): `pinned` — always at the bottom of the area, `inline` — after the last row, scrolls with the body',
  table: { defaultValue: { summary: 'pinned' } },
}
export const enableToolbarType = panelFlag(
  'Top toolbar: auto — when plugins add buttons, on — always (even empty), off — never',
)
export const enableStatusBarType = panelFlag(
  'Status bar: auto — when it has slots, on — always (even empty), off — never',
)
export const enableAnnouncementsType = booleanControl(
  'Screen reader announcements through a live region: sorting, selection, loading (`enableAnnouncements`)',
  true,
)

export const enableRowAnimationType = booleanControl(
  'Row motion when the model changes: expanding, sorting, filtering, reordering (`enableRowAnimation`, ADR 0107)',
  true,
)

export const enableIncrementalRenderType = booleanControl(
  'First render and whole-window changes in chunks, via React transitions; off — in a single pass (`enableIncrementalRender`, ADR 0203)',
  true,
)

export const enableColumnAnimationType = booleanControl(
  'Column motion when the order changes: revert, keyboard, drag handle menu (`enableColumnAnimation`, ADR 0115)',
  true,
)

export const enableOverflowTooltipType = booleanControl(
  'A tooltip with the full text for cell text truncated with an ellipsis (`enableOverflowTooltip`)',
  true,
)

// --- Колонки -------------------------------------------------------------------

export const enableColumnSortingType = booleanControl(
  'Sorting with a header button (`columnSorting` plugin)',
)
export const columnSortingRemovalType = booleanControl(
  'A third click removes sorting (`removal`); otherwise the direction only toggles',
  true,
)
export const columnSortingMultiSortType = booleanControl(
  'Multi-column sorting with Shift+click (`multiSort`); `max` and `event` are set by the story as an object',
  true,
)
export const columnSortingRevertOnRejectType = booleanControl(
  'Revert sorting when the `onToggleColumnSort` promise rejects in server mode (`revertOnReject`, ADR 0116)',
  true,
)
export const enableColumnSortingModelType = booleanControl(
  'Sorting without buttons: row order from the `sorting` state (`columnSortingModel` plugin)',
)
export const columnSortingModelMultiSortType = booleanControl(
  'Several columns in the `sorting` slice (`multiSort`); otherwise only the first applies',
  true,
)
export const enableColumnSizingType = booleanControl(
  'Resizing columns by dragging the border (`columnSizing` plugin)',
)
export const enableColumnDraggingType = booleanControl(
  'Reordering columns by dragging the header (`columnDragging` plugin)',
)
export const enableColumnPinningType = booleanControl(
  'Pinning columns with a header button (`columnPinning` plugin)',
)
export const retrySucceedsType = booleanControl('Retrying the load succeeds')
export const hideAllColumnsType = booleanControl(
  'All columns hidden by the app state (`columnVisibility`): the all-columns-hidden placeholder (ADR 0123)',
)
export const pinFirstColumnType = booleanControl(
  'The first column is pinned left on open (initial pinning, toggles on the fly)',
)
export const columnPinningLeafPinningType = booleanControl(
  'Pinning individual leaves under a nested column header (`leafPinning`)',
)
export const enableColumnVisibilityType = booleanControl(
  'The “Columns” button in the toolbar: hiding and showing columns (`columnVisibility` plugin)',
)
export const enableHeaderActionMenuType = booleanControl(
  'Collapse header buttons into a menu button (`headerActionMenu` plugin)',
)
const menuModeType = (description: string) =>
  radioControl(description, ['auto', 'always'], 'auto')
export const headerActionMenuModeType = menuModeType(
  'Header menu button: auto — once the action count reaches the threshold, always — always (`mode`)',
)
export const headerActionMenuThresholdType = numberControl(
  'Number of actions at which header buttons move into the menu button (`threshold`)',
  { min: 1, max: 10, step: 1 },
  String(DEFAULT_HEADER_ACTION_MENU.threshold),
)

// --- Строки --------------------------------------------------------------------

export const enableRowSelectionType = booleanControl(
  'Row selection with checkboxes (`rowSelection` plugin)',
)
export const enableRowSelectionModelType = booleanControl(
  'Row selection without checkboxes: selected rows from the `rowSelection` state (`rowSelectionModel` plugin)',
)
/**
 * Выбор вложенных строк (ADR 0162): нет — только строки верхнего уровня, `true` — с
 * потомками, `'self'` — каждая строка сама.
 */
const subRowsControl = (description: string): InputType => ({
  control: {
    type: 'inline-radio',
    labels: { false: 'off', true: 'cascade', self: 'self' },
  },
  options: [false, true, 'self'],
  description,
  table: { defaultValue: { summary: 'false' } },
})
export const rowSelectionModelSubRowsType = subRowsControl(
  'Selecting nested rows of the model (`subRows`): `true` — with descendants, `self` — each row on its own',
)
export const rowSelectionSubRowsType = subRowsControl(
  'Checkboxes on nested rows (`subRows`): `true` — selection with descendants, `self` — each row on its own',
)
export const rowSelectionSelectAllType = radioControl(
  'What the header checkbox selects: filtered rows on all pages, the current page, or all data rows (`selectAll`)',
  ['filtered', 'currentPage', 'all'],
  'filtered',
)
export const rowSelectionSelectedCountType = booleanControl(
  'Selected row count in the status bar (`selectedCount`)',
)
export const enableRowExpandingType = booleanControl(
  'Expanding rows with child rows (`rowExpanding` plugin)',
)
export const rowExpandingMaxDepthType = numberControl(
  'How many levels from the root can be expanded (`maxDepth`)',
  { min: 0, max: 10, step: 1 },
  String(DEFAULT_MAX_EXPANDING_DEPTH),
)
export const rowExpandingExpandAllType = booleanControl(
  'An “Expand all / Collapse all” button in the header of the expand column (`expandAll`)',
  true,
)
export const rowExpandingStickyRowsType = booleanControl(
  'A branch row sticks under the header while its child rows are visible (`stickyRows`)',
)
export const rowGroupingGroupRowCountType = booleanControl(
  'Number of data rows in a group row',
)
export const rowGroupingStickyRowsType = booleanControl(
  'A group row sticks under the header while its rows are visible (`stickyRows`)',
)
export const rowExpandingColumnType = radioControl(
  'Expand toggle column: auto — when some rows have child rows, always — always (`column`)',
  ['auto', 'always'],
  'auto',
)
export const enableRowExpandingModelType = booleanControl(
  'A tree without a toggle: sub-rows from the `expanded` state (`rowExpandingModel` plugin)',
)
export const enableTreeLinesType = booleanControl(
  'Tree lines for expanded rows and groups (`treeLines` plugin)',
)
export const enableTextWrapType = booleanControl(
  'Text wrapping and content-based row height for columns with `wrapText` and `autoHeight` (`textWrap` plugin)',
)
export const textWrapEstimatedRowHeightType = numberControl(
  'Estimated height of a row not yet measured, px; empty — the row height is used (`estimatedRowHeight`)',
  { min: MIN_ROW_HEIGHT, max: 300, step: 2 },
  'row height',
)
export const textWrapMaxLinesType = numberControl(
  'Maximum lines in an `autoHeight` cell; beyond that, `…` with a tooltip (`maxLines`)',
  { min: 1, max: 30, step: 1 },
  '10',
)
export const textWrapHeaderMaxLinesType = numberControl(
  'Maximum lines in an `autoHeaderHeight` header; beyond that, `…` with a tooltip (`headerMaxLines`)',
  { min: 1, max: 10, step: 1 },
  '3',
)
export const enableRowDraggingType = booleanControl(
  'Reordering rows by dragging the drag handle (`rowDragging` plugin)',
)
export const rowDraggingExpandDelayType = numberControl(
  'Hover delay over a collapsed group before it expands, ms; 0 — never expand (`expandDelay`)',
  { min: 0, max: 2000, step: 100 },
  String(DEFAULT_ROW_DRAG_EXPAND_DELAY),
)
export const rowDraggingRevertOnRejectType = booleanControl(
  'Revert a row move when the `onRowDragEnd` promise rejects (`revertOnReject`, ADR 0114)',
  true,
)
export const columnDraggingRevertOnRejectType = booleanControl(
  'Revert a column move when the `onColumnDragEnd` promise rejects (`revertOnReject`, ADR 0114)',
  true,
)
export const columnSizingAutosizeOnDataType = booleanControl(
  'Fit column widths to content when data arrives (`autosizeOnData`, ADR 0217)',
)
export const enableRowGroupingType = booleanControl(
  'Row grouping with a header button (`rowGrouping` plugin)',
)
export const enableRowGroupingModelType = booleanControl(
  'Grouping without buttons: groups from the `grouping` state (`rowGroupingModel` plugin)',
)
export const enableRowActionsType = booleanControl(
  'A row actions column with demo buttons (`rowActions` plugin)',
)
export const rowActionsWidthType = numberControl(
  'Width of the actions column with buttons, px (`width`)',
  { min: 40, max: 400, step: 4 },
  String(DEFAULT_ROW_ACTIONS_OPTIONS.width),
)
export const rowActionsCollapsedWidthType = numberControl(
  'Width of the actions column when the actions are in the menu button, px (`collapsedWidth`)',
  { min: 40, max: 400, step: 4 },
  String(DEFAULT_ROW_ACTIONS_OPTIONS.collapsedWidth),
)
export const rowActionsColumnType = radioControl(
  'Actions column: auto — when rows have actions, always — always (`column`)',
  ['auto', 'always'],
  'auto',
)
export const actionsDemoType = radioControl(
  'Row action set: basic — edit, copy, delete; async — with a server response; nested — with sections; none — no actions',
  ['basic', 'async', 'nested', 'none'],
  'basic',
)
export const enableRowActionMenuType = booleanControl(
  'Collapse row actions into a menu button (`rowActionMenu` plugin, needs enableRowActions)',
)
export const rowActionMenuModeType = menuModeType(
  'Row menu button: auto — once the action count reaches the threshold, always — always (`mode`)',
)
export const rowActionMenuThresholdType = numberControl(
  'Number of actions at which row buttons move into the menu button (`threshold`)',
  { min: 1, max: 10, step: 1 },
  String(DEFAULT_ROW_ACTION_MENU.threshold),
)

// --- Ячейки и клавиатура -------------------------------------------------------

export const enableCellEditingType = booleanControl(
  'Editing Age, Visits, Gender cells: a button on hover (`cellEditing` plugin)',
)
export const enableCellErrorsType = booleanControl(
  'Cell errors: a red dot on Visits cells above 15 (`cellErrors` plugin)',
)
export const enableValueChangeFlashType = booleanControl(
  'A cell flash when new data changes the value (`valueChangeFlash` plugin)',
)
export const valueChangeFlashColumnDefaultType = radioControl(
  'Look of columns without their own `changeFlash` (`columnDefault`): `true` — a flash, `direction` — a tone and an arrow for rise and fall, `false` — no flash',
  [true, 'direction', false],
  'true',
)
export const enableCellSelectionType = booleanControl(
  'Selecting a range of cells with the mouse and copying with Ctrl/Cmd+C (`cellSelection` plugin)',
)
export const enableCellSelectionModelType = booleanControl(
  'Cell selection without the mouse: highlighting from the `cellSelection` state (`cellSelectionModel` plugin)',
)
export const cellSelectionRangeSelectionType = booleanControl(
  'A range with Shift+click (`rangeSelection`)',
  true,
)
export const dataExportMaxLoadedRowsType = numberControl(
  'Export from the server row model loads no more rows than this (`maxLoadedRows`)',
  { min: 1, max: 1_000_000, step: 1 },
  '10000',
)
export const cellSelectionDragSelectionType = booleanControl(
  'A range by dragging the mouse (`dragSelection`)',
  true,
)
export const cellSelectionMultiRangeType = booleanControl(
  'Several ranges with Ctrl/Cmd (`multiRange`)',
  true,
)
/**
 * Маркер угла выделения (ADR 0198): в Controls это строка радио, до истории `mapping`
 * доносит аргумент `handle` фабрики.
 */
export const RANGE_HANDLE_MAPPING = {
  all: undefined,
  mouse: { touch: false },
  touch: { mouse: false },
  off: false,
  fill: { mode: 'fill' },
  fillDown: { mode: 'fill', direction: 'y' },
} as const
export const cellSelectionHandleType: InputType = {
  control: 'inline-radio',
  options: Object.keys(RANGE_HANDLE_MAPPING),
  mapping: RANGE_HANDLE_MAPPING,
  description:
    'Selection corner handle (`handle`): `all` — for mouse and finger, `mouse` and `touch` — for one input only, `off` — no handle; `fill` — dragging the square fills values into cells (`mode`), `fillDown` — fills only down and up (`direction`)',
  table: { defaultValue: { summary: 'all' } },
}
export const cellSelectionMaxCopyRowsType = numberControl(
  'Copying puts no more selected rows than this on the clipboard (`maxCopyRows`)',
  { min: 1, max: 1_000_000, step: 1 },
  '10000',
)
export const cellSelectionPasteType = booleanControl(
  'Pasting from the clipboard, cutting, and clearing the selection (`paste`); they write through the editing plugin',
)
export const enableContextMenuType = booleanControl(
  'A context menu on right click (`contextMenu` plugin)',
)
export const enableKeyboardNavigationType = booleanControl(
  'Arrow-key navigation between cells: the grid role, roving tabindex (`enableKeyboardNavigation`)',
)

// --- Поиск, фильтры, страницы, экспорт -----------------------------------------

const debounceType = (description: string, defaultMs: number) =>
  numberControl(description, { min: 0, max: 2000, step: 50 }, String(defaultMs))

export const enableQuickSearchType = booleanControl(
  'Quick search in the toolbar across visible columns (`quickSearch` plugin)',
)
export const quickSearchDebounceMsType = debounceType(
  'Search input delay, ms (`debounceMs`)',
  DEFAULT_SEARCH_DEBOUNCE_MS,
)
export const quickSearchFilteredCountType = booleanControl(
  '“Showing N of M” in the status bar (`filteredCount`)',
)
export const enableColumnFilteringType = booleanControl(
  'Filters for columns with a filter field: Country and names — text, Age, Visits, Total — number (`columnFiltering` plugin)',
)
export const cellEditingSaveModeType = radioControl(
  'Saving edits (`saveMode`): `auto` — each finished edit is sent right away, `manual` — edits accumulate as drafts and are sent as a batch with a button in the unsaved changes panel',
  ['auto', 'manual'],
  'auto',
)
export const enableEditHistoryType = booleanControl(
  'Undo and redo of edits: Ctrl+Z and Ctrl+Shift+Z, buttons and history in the toolbar, context menu items (`editHistory` plugin)',
)
export const editHistoryLimitType = numberControl(
  'How many entries the history keeps (`limit`); the oldest is dropped',
  { min: 1, max: 200, step: 1 },
  '30',
)
export const editHistoryMaxCellsType = numberControl(
  'How many cells all history entries keep together (`maxCells`); the oldest are dropped',
  { min: 1, max: 1_000_000, step: 1000 },
  '50000',
)
/** Виды изменений, которые пишутся в историю (ADR 0222, §16). */
export const editHistorySourcesType: InputType = {
  control: 'check',
  options: [
    'edit',
    'paste',
    'fill',
    'fillDown',
    'fillRight',
    'bulk',
    'clear',
    'cut',
    'api',
    'row',
    'move',
    'discard',
    'app',
  ],
  description:
    'Which changes are recorded in the history (`sources`); nothing checked — all. Unrecorded changes cannot be undone',
  table: { defaultValue: { summary: 'all' } },
}
export const editHistoryConflictType = radioControl(
  'The cell was changed externally after the edit (`conflict`): `skip` — undo skips it, `overwrite` — writes over it',
  ['skip', 'overwrite'],
  'skip',
)
export const editHistoryContextMenuType = booleanControl(
  '“Undo” and “Redo” items in the cell context menu (`contextMenu`)',
  true,
)
export const cellEditingSearchDebounceMsType = numberControl(
  'Delay of the lookup request while searching in the option editor, ms (`searchDebounceMs`); 0 — on every keystroke',
  { min: 0, max: 2000, step: 50 },
  '0',
)
export const columnFilteringDebounceMsType = debounceType(
  'Filter input delay, ms (`debounceMs`)',
  DEFAULT_FILTER_DEBOUNCE_MS,
)
export const columnFilteringFilteredCountType = booleanControl(
  '“Showing N of M” in the status bar (`filteredCount`)',
)
export const enableColumnFilteringModelType = booleanControl(
  'Filters without buttons: rows from the `columnFilters` state (`columnFilteringModel` plugin)',
)
export const enableQuickSearchModelType = booleanControl(
  'Search without a field: rows from the `globalFilter` state (`quickSearchModel` plugin)',
)
export const enableInfiniteScrollType = booleanControl(
  'Infinite scroll — a feed: near the edge the table asks for a block (`infiniteScroll` plugin); the story appends the data',
)
export const infiniteScrollThresholdType = numberControl(
  'How many rows before the edge to ask for a block (`threshold`)',
  { min: 0, max: 200, step: 5 },
  '—',
)
export const infiniteScrollLoadedCountType = booleanControl(
  'Loaded row count in the status bar (`loadedCount`)',
)
export const enableServerRowModelType = booleanControl(
  'Server row model: rows come from the server in blocks for the scroll window, cached by the table (`serverRowModel` plugin); the story provides the loader',
)
export const serverRowModelBlockSizeType = numberControl(
  'Rows per block (`blockSize`)',
  { min: 10, max: 500, step: 10 },
  '100',
)
export const serverRowModelMaxBlocksType = numberControl(
  'How many blocks to keep in the cache (`maxBlocks`)',
  { min: 1, max: 200, step: 1 },
  '100',
)
export const enableColumnTotalsType = booleanControl(
  'Totals in the footer for columns with an explicit aggregate',
)
export const enableColumnAggregationType = booleanControl(
  'Summary of a column: the user picks the function of the total and of group values in the column menu (`columnAggregation` plugin)',
)
export const enableFailureLogType = booleanControl(
  'Failure log in the toolbar: a button with a count while there are unresolved refusals; it only joins a toolbar that is already shown (`failureLog` plugin)',
)
export const enableUnsavedChangesType = booleanControl(
  'Unsaved changes panel in the toolbar: a button with a count of unapplied changes and their list; it only joins a toolbar that is already shown (`unsavedChanges` plugin)',
)
export const enableBackToTopType = booleanControl(
  '“Back to top” and “Back to first column” buttons in the status bar: visible after scrolling two screens; they only join a status bar that is already shown (`backToTop` plugin)',
)
export const backToTopThresholdType = numberControl(
  'Vertical scroll at which “Back to top” appears, px (`threshold`); defaults to two body heights',
  { min: 0, max: 20000, step: 100 },
  '—',
)
export const backToTopHorizontalThresholdType = numberControl(
  'Horizontal scroll at which “Back to first column” appears, px (`horizontalThreshold`); defaults to two body widths',
  { min: 0, max: 20000, step: 100 },
  '—',
)
export const backToTopAxesType = radioControl(
  'Which buttons to show (`axes`)',
  ['vertical', 'horizontal', 'both'],
  'both',
)
export const enablePaginationType = booleanControl(
  'Pagination in the status bar (`pagination` plugin)',
)
export const paginationInitialPageSizeType = numberControl(
  'Initial page size (`initialPageSize`)',
  { min: 1, max: 1000, step: 5 },
  String(DEFAULT_PAGE_SIZE),
)
export const paginationPageSizesType = objectControl(
  'Page size options in the status bar; `false` — no page size selector (`pageSizes`)',
  'number[] | false',
  DEFAULT_PAGE_SIZES,
)
export const paginationPageNumbersType = radioControl(
  'Going to a page: number buttons, a number field, or just the four buttons',
  ['buttons', 'input', false],
  'buttons',
)
export const paginationRevertOnRejectType = booleanControl(
  'Return to the previous page when the `onPageChange` promise rejects in server mode (`revertOnReject`, ADR 0116)',
  true,
)
export const enablePaginationModelType = booleanControl(
  'Pages without a pager: rows of the current page from the `pagination` state (`paginationModel` plugin)',
)
export const paginationModelInitialPageSizeType = numberControl(
  'Initial page size of the model (`initialPageSize`)',
  { min: 1, max: 1000, step: 5 },
  String(DEFAULT_PAGE_SIZE),
)
export const enableDataExportModelType = booleanControl(
  'Export without a button: only `table.exportData` (`dataExportModel` plugin)',
)
export const enableDataExportType = booleanControl(
  'The “Export” button in the toolbar: a settings panel and export to CSV (`dataExport` plugin)',
)
export const dataExportAllowType = objectControl(
  'Export axes available to the user (`allow`)',
  'ExportAllow',
  {},
)
export const dataExportFilenameType: InputType = {
  control: 'text',
  description: 'File name without extension (`filename`); defaults to `export`',
  table: { defaultValue: { summary: 'export' } },
}

/** Место встроенной кнопки плагина в тулбаре (ADR 0205): `{ group, order, align }` или `false`. */
const toolbarPlacementControl = (button: string): InputType => ({
  control: 'object',
  description: `Position of the “${button}” button in the toolbar: \`{ group, order, align }\`; \`false\` — no button`,
  table: {
    type: { summary: 'ToolbarPlacement | false' },
    defaultValue: { summary: 'built-in' },
  },
})
export const quickSearchToolbarType = toolbarPlacementControl('Search')
export const dataExportToolbarType = toolbarPlacementControl('Export')
export const unsavedChangesToolbarType =
  toolbarPlacementControl('Unsaved changes')
export const failureLogToolbarType = toolbarPlacementControl('Failure log')
export const editHistoryToolbarType = toolbarPlacementControl('Undo and Redo')
export const editHistoryHistoryPanelType =
  toolbarPlacementControl('Change history')
