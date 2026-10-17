/**
 * Контролы историй DataGrid по группам. Все — в песочнице `All features`; остальные
 * истории показывают базовый набор и свой список через `showControls` (ADR 0117).
 * Настройка фичи видна, пока фича включена; форма мока — пока история не подаёт свои
 * данные и колонки. Имена — по правилу ADR 0106: `enable<Фабрика>` и `<фабрика><Опция>`.
 */
import type { InputType } from 'storybook/internal/csf'

import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../../../lib/plugins/rowActions'
import { DEFAULT_HEADER_ACTION_MENU } from '../../../../lib/plugins/headerActionMenu'
import { DEFAULT_ROW_ACTION_MENU } from '../../../../lib/plugins/rowActionMenu'
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZES,
} from '../../../../lib/plugins/pagination/registry'
import { DEFAULT_MAX_EXPANDING_DEPTH } from '../../../../lib/plugins/rowExpanding/registry'
import { DEFAULT_ROW_DRAG_EXPAND_DELAY } from '../../../../lib/plugins/rowDragging/getRowDraggingEvents'
import { DEFAULT_SKELETON_OPTIONS } from '../../../../lib/core/skeletonOptions'
import { DEFAULT_COLUMN } from '../../../../lib/core/defaultColumn'
import { DEFAULT_REFRESH_OPTIONS } from '../../../../lib/core/loadingDisplay'
import {
  DEFAULT_COLUMN_FILTERING_OPTIONS,
  DEFAULT_QUICK_SEARCH_OPTIONS,
  backToTopAxesType,
  backToTopHorizontalThresholdType,
  backToTopThresholdType,
  cellSelectionDragSelectionType,
  cellSelectionMultiRangeType,
  cellSelectionRangeSelectionType,
  columnCountType,
  columnFilteringDebounceMsType,
  columnFilteringFilteredCountType,
  columnFilteringModelTimeZoneType,
  columnFilteringTimeZoneType,
  columnPinningLeafPinningType,
  pinFirstColumnType,
  hideAllColumnsType,
  columnSortingModelMultiSortType,
  columnSortingModelServerType,
  columnSortingMultiSortType,
  columnSortingRemovalType,
  columnSortingRevertOnRejectType,
  columnSortingServerType,
  containerSizeType,
  contrastType,
  dataCountType,
  dataExportAllowType,
  dataExportFilenameType,
  dataNestingType,
  defaultColumnType,
  enableAnnouncementsType,
  enableBackToTopType,
  enableCellEditingType,
  enableCellSelectionModelType,
  enableCellSelectionType,
  enableColumnDraggingType,
  enableColumnFilteringModelType,
  enableColumnFilteringType,
  enableColumnPinningType,
  enableColumnSizingType,
  enableColumnSortingModelType,
  enableColumnSortingType,
  enableColumnVisibilityType,
  enableContextMenuType,
  enableDataExportModelType,
  enableDataExportType,
  enableFooterType,
  footerPositionType,
  enableHeaderActionMenuType,
  enableInfiniteScrollType,
  enableKeyboardNavigationType,
  enableOverflowTooltipType,
  enableRowAnimationType,
  enableColumnAnimationType,
  enablePaginationModelType,
  enablePaginationType,
  enableQuickSearchModelType,
  enableQuickSearchType,
  enableRowActionMenuType,
  enableRowActionsType,
  enableRowDraggingType,
  enableRowExpandingType,
  expandAllType,
  enableRowGroupingModelType,
  enableRowGroupingType,
  enableRowSelectionModelType,
  enableRowSelectionType,
  enableStatusBarType,
  enableToolbarType,
  headerActionMenuModeType,
  headerActionMenuThresholdType,
  headerHeightType,
  headerNestingType,
  inCategory,
  infiniteScrollLoadedCountType,
  infiniteScrollThresholdType,
  loadingType,
  localeType,
  heightType,
  maxHeightType,
  paginationInitialPageSizeType,
  paginationModelInitialPageSizeType,
  paginationPageSizesType,
  paginationRevertOnRejectType,
  quickSearchDebounceMsType,
  quickSearchFilteredCountType,
  refreshOptionsType,
  rowActionMenuModeType,
  rowActionMenuThresholdType,
  rowActionsCollapsedWidthType,
  rowActionsColumnType,
  rowActionsWidthType,
  rowExpandingColumnType,
  rowExpandingMaxDepthType,
  rowDraggingExpandDelayType,
  rowDraggingRevertOnRejectType,
  columnDraggingRevertOnRejectType,
  enableRowExpandingModelType,
  enableTreeLinesType,
  rowHeightType,
  rowSelectionSelectedCountType,
  rowSelectionModelSubRowsType,
  rowSelectionSubRowsType,
  showStubType,
  skeletonOptionsType,
} from './argTypes'

/** Контрол виден, пока включена фича `arg` (или пока аргумент не задан историей). */
const when = (arg: string, types: Record<string, InputType>) =>
  Object.fromEntries(
    Object.entries(types).map(([name, type]) => [
      name,
      { ...type, if: { arg } },
    ]),
  )
/** Контрол виден при значении `eq` аргумента `arg`. */
const whenEq = (arg: string, eq: string, types: Record<string, InputType>) =>
  Object.fromEntries(
    Object.entries(types).map(([name, type]) => [
      name,
      { ...type, if: { arg, eq } },
    ]),
  )
const unless = (arg: string, type: InputType): InputType => ({
  ...type,
  if: { arg, exists: false },
})

export const dataGridArgTypes = {
  ...inCategory('Данные и размеры', {
    columnCount: unless('columnsOverride', columnCountType),
    dataCount: unless('dataOverride', dataCountType),
    dataNesting: unless('dataOverride', dataNestingType),
    headerNesting: unless('columnsOverride', headerNestingType),
    containerHeight: containerSizeType,
    rowHeight: rowHeightType,
    headerHeight: headerHeightType,
    defaultColumn: defaultColumnType,
    height: heightType,
    maxHeight: maxHeightType,
    showStub: showStubType,
  }),
  ...inCategory('Ядро: панели и состояния', {
    loading: loadingType,
    ...whenEq('loading', 'initial', { skeletonOptions: skeletonOptionsType }),
    ...whenEq('loading', 'refresh', { refreshOptions: refreshOptionsType }),
    contrast: contrastType,
    enableFooter: enableFooterType,
    ...when('enableFooter', { footerPosition: footerPositionType }),
    enableToolbar: enableToolbarType,
    enableStatusBar: enableStatusBarType,
    enableAnnouncements: enableAnnouncementsType,
    enableOverflowTooltip: enableOverflowTooltipType,
    enableRowAnimation: enableRowAnimationType,
    enableColumnAnimation: enableColumnAnimationType,
    locale: localeType,
  }),
  ...inCategory(
    'Колонки',
    {
      enableColumnSorting: enableColumnSortingType,
      ...when('enableColumnSorting', {
        columnSortingRemoval: columnSortingRemovalType,
        columnSortingMultiSort: columnSortingMultiSortType,
        columnSortingServer: columnSortingServerType,
        columnSortingRevertOnReject: columnSortingRevertOnRejectType,
      }),
      enableColumnSortingModel: enableColumnSortingModelType,
      ...when('enableColumnSortingModel', {
        columnSortingModelServer: columnSortingModelServerType,
        columnSortingModelMultiSort: columnSortingModelMultiSortType,
      }),
    },
    'Сортировка',
  ),
  ...inCategory(
    'Колонки',
    {
      enableColumnPinning: enableColumnPinningType,
      pinFirstColumn: pinFirstColumnType,
      hideAllColumns: hideAllColumnsType,
      ...when('enableColumnPinning', {
        columnPinningLeafPinning: columnPinningLeafPinningType,
      }),
    },
    'Закрепление',
  ),
  ...inCategory(
    'Колонки',
    {
      enableColumnSizing: enableColumnSizingType,
      enableColumnDragging: enableColumnDraggingType,
      ...when('enableColumnDragging', {
        columnDraggingRevertOnReject: columnDraggingRevertOnRejectType,
      }),
      enableColumnVisibility: enableColumnVisibilityType,
      enableHeaderActionMenu: enableHeaderActionMenuType,
      ...when('enableHeaderActionMenu', {
        headerActionMenuMode: headerActionMenuModeType,
        headerActionMenuThreshold: headerActionMenuThresholdType,
      }),
    },
    'Ширина, порядок, видимость',
  ),
  ...inCategory(
    'Строки',
    {
      enableRowSelection: enableRowSelectionType,
      ...when('enableRowSelection', {
        rowSelectionSubRows: rowSelectionSubRowsType,
        rowSelectionSelectedCount: rowSelectionSelectedCountType,
      }),
      enableRowSelectionModel: enableRowSelectionModelType,
      ...when('enableRowSelectionModel', {
        rowSelectionModelSubRows: rowSelectionModelSubRowsType,
      }),
    },
    'Выбор',
  ),
  ...inCategory(
    'Строки',
    {
      enableRowExpanding: enableRowExpandingType,
      ...when('enableRowExpanding', {
        rowExpandingMaxDepth: rowExpandingMaxDepthType,
        rowExpandingColumn: rowExpandingColumnType,
        expandAll: expandAllType,
      }),
      enableRowExpandingModel: enableRowExpandingModelType,
      enableTreeLines: enableTreeLinesType,
    },
    'Раскрытие',
  ),
  ...inCategory(
    'Строки',
    {
      enableRowDragging: enableRowDraggingType,
      ...when('enableRowDragging', {
        rowDraggingExpandDelay: rowDraggingExpandDelayType,
        rowDraggingRevertOnReject: rowDraggingRevertOnRejectType,
      }),
      enableRowGrouping: enableRowGroupingType,
      enableRowGroupingModel: enableRowGroupingModelType,
    },
    'Порядок и группировка',
  ),
  ...inCategory(
    'Строки',
    {
      enableRowActions: enableRowActionsType,
      ...when('enableRowActions', {
        rowActionsWidth: rowActionsWidthType,
        rowActionsCollapsedWidth: rowActionsCollapsedWidthType,
        rowActionsColumn: rowActionsColumnType,
      }),
      enableRowActionMenu: enableRowActionMenuType,
      ...when('enableRowActionMenu', {
        rowActionMenuMode: rowActionMenuModeType,
        rowActionMenuThreshold: rowActionMenuThresholdType,
      }),
    },
    'Действия',
  ),
  ...inCategory('Ячейки и клавиатура', {
    enableCellEditing: enableCellEditingType,
    enableCellSelectionModel: enableCellSelectionModelType,
    enableCellSelection: enableCellSelectionType,
    ...when('enableCellSelection', {
      cellSelectionRangeSelection: cellSelectionRangeSelectionType,
      cellSelectionDragSelection: cellSelectionDragSelectionType,
      cellSelectionMultiRange: cellSelectionMultiRangeType,
    }),
    enableContextMenu: enableContextMenuType,
    enableKeyboardNavigation: enableKeyboardNavigationType,
  }),
  ...inCategory('Поиск, фильтры, страницы, экспорт', {
    enableQuickSearch: enableQuickSearchType,
    ...when('enableQuickSearch', {
      quickSearchDebounceMs: quickSearchDebounceMsType,
      quickSearchFilteredCount: quickSearchFilteredCountType,
    }),
    enableColumnFiltering: enableColumnFilteringType,
    ...when('enableColumnFiltering', {
      columnFilteringDebounceMs: columnFilteringDebounceMsType,
      columnFilteringFilteredCount: columnFilteringFilteredCountType,
      columnFilteringTimeZone: columnFilteringTimeZoneType,
    }),
    enableColumnFilteringModel: enableColumnFilteringModelType,
    ...when('enableColumnFilteringModel', {
      columnFilteringModelTimeZone: columnFilteringModelTimeZoneType,
    }),
    enableQuickSearchModel: enableQuickSearchModelType,
    enablePagination: enablePaginationType,
    ...when('enablePagination', {
      paginationInitialPageSize: paginationInitialPageSizeType,
      paginationPageSizes: paginationPageSizesType,
      paginationRevertOnReject: paginationRevertOnRejectType,
    }),
    enablePaginationModel: enablePaginationModelType,
    ...when('enablePaginationModel', {
      paginationModelInitialPageSize: paginationModelInitialPageSizeType,
    }),
    enableInfiniteScroll: enableInfiniteScrollType,
    ...when('enableInfiniteScroll', {
      infiniteScrollThreshold: infiniteScrollThresholdType,
      infiniteScrollLoadedCount: infiniteScrollLoadedCountType,
    }),
    enableBackToTop: enableBackToTopType,
    ...when('enableBackToTop', {
      backToTopThreshold: backToTopThresholdType,
      backToTopHorizontalThreshold: backToTopHorizontalThresholdType,
      backToTopAxes: backToTopAxesType,
    }),
    enableDataExport: enableDataExportType,
    ...when('enableDataExport', {
      dataExportAllow: dataExportAllowType,
      dataExportFilename: dataExportFilenameType,
    }),
    enableDataExportModel: enableDataExportModelType,
  }),
}

/** Базовый набор: в каждой истории, пока контрол на неё влияет (ADR 0117). */
export const BASE_CONTROLS = [
  'columnCount',
  'dataCount',
  'containerHeight',
  'rowHeight',
  'headerHeight',
  'defaultColumn',
  'height',
  'maxHeight',
] as const

export type BaseControl = (typeof BASE_CONTROLS)[number]

/**
 * Панель истории: базовый набор и `names`. `hidden` убирает базовый контрол, который
 * в истории ни на что не влияет, — с причиной.
 */
export const showControls = (
  names: readonly string[],
  hidden: Partial<Record<BaseControl, string>> = {},
) => ({
  controls: {
    include: [...BASE_CONTROLS.filter(name => !(name in hidden)), ...names],
  },
  controlsHidden: hidden,
})

/**
 * Панель истории сценария с гайдом (ADR 0117, SN28): контролов нет — таблицу и её
 * функции по шагам задаёт гайд, вариации — в песочнице `Default` фичи.
 */
export const guideControls = () =>
  showControls(
    [],
    Object.fromEntries(
      BASE_CONTROLS.map(name => [
        name,
        'Таблицу и её функции по шагам задаёт гайд; вариации — в Default',
      ]),
    ),
  )

/**
 * Вариант «auto» флага панели (ADR 0046): в Controls это строка радио, а до истории
 * `mapping` доносит `undefined` — тип аргумента после него.
 */
const PANEL_AUTO = 'auto' as unknown as undefined

/**
 * Флаг панели для грида: истории, отрисованные мимо Storybook (тесты), получают «auto»
 * без `mapping` — это «не задано».
 */
export const panelFlag = (value: boolean | undefined) =>
  value === PANEL_AUTO ? undefined : value

/** Вариант «off» загрузки (ADR 0106): `mapping` доносит `false`, тесты — строку. */
const LOADING_OFF = 'off' as unknown as false

/** Загрузка для грида: истории мимо Storybook (тесты) получают «off» без `mapping`. */
export const loadingArg = (value: 'initial' | 'refresh' | false | undefined) =>
  value === LOADING_OFF ? false : value

/**
 * Значения по умолчанию — те же, что у библиотеки без аргумента: история ведёт себя
 * как раньше. Высоты не задаём: без них грид берёт их из токенов темы и раскладки.
 */
export const dataGridDefaultArgs = {
  dataNesting: 'flat',
  headerNesting: 'flat',
  showStub: false,
  defaultColumn: { size: 150, ...DEFAULT_COLUMN },

  loading: LOADING_OFF,
  skeletonOptions: DEFAULT_SKELETON_OPTIONS,
  refreshOptions: DEFAULT_REFRESH_OPTIONS,
  contrast: 'auto',
  enableFooter: false,
  footerPosition: 'pinned',
  enableToolbar: PANEL_AUTO,
  enableStatusBar: PANEL_AUTO,
  enableAnnouncements: true,
  enableOverflowTooltip: true,
  enableRowAnimation: true,
  enableColumnAnimation: true,
  locale: 'en',

  enableColumnSorting: false,
  columnSortingRemoval: true,
  columnSortingMultiSort: true,
  columnSortingServer: false,
  columnSortingRevertOnReject: true,
  enableColumnSortingModel: false,
  columnSortingModelServer: false,
  columnSortingModelMultiSort: true,
  enableColumnSizing: false,
  enableColumnDragging: false,
  columnDraggingRevertOnReject: true,
  enableColumnPinning: false,
  columnPinningLeafPinning: false,
  enableColumnVisibility: false,
  enableHeaderActionMenu: false,
  headerActionMenuMode: DEFAULT_HEADER_ACTION_MENU.mode,
  headerActionMenuThreshold: DEFAULT_HEADER_ACTION_MENU.threshold,

  enableRowSelection: false,
  enableRowSelectionModel: false,
  rowSelectionModelSubRows: false,
  rowSelectionSubRows: false,
  rowSelectionSelectedCount: false,
  enableRowExpanding: false,
  rowExpandingMaxDepth: DEFAULT_MAX_EXPANDING_DEPTH,
  rowExpandingColumn: 'auto',
  enableRowExpandingModel: false,
  enableTreeLines: false,
  enableRowDragging: false,
  rowDraggingExpandDelay: DEFAULT_ROW_DRAG_EXPAND_DELAY,
  rowDraggingRevertOnReject: true,
  enableRowGrouping: false,
  enableRowGroupingModel: false,
  enableRowActions: false,
  rowActionsWidth: DEFAULT_ROW_ACTIONS_OPTIONS.width,
  rowActionsCollapsedWidth: DEFAULT_ROW_ACTIONS_OPTIONS.collapsedWidth,
  rowActionsColumn: 'auto',
  enableRowActionMenu: false,
  rowActionMenuMode: DEFAULT_ROW_ACTION_MENU.mode,
  rowActionMenuThreshold: DEFAULT_ROW_ACTION_MENU.threshold,

  enableCellEditing: false,
  enableCellSelection: false,
  enableCellSelectionModel: false,
  cellSelectionRangeSelection: true,
  cellSelectionDragSelection: true,
  cellSelectionMultiRange: true,
  enableContextMenu: false,
  enableKeyboardNavigation: false,

  enableQuickSearch: false,
  quickSearchDebounceMs: DEFAULT_QUICK_SEARCH_OPTIONS.debounceMs,
  quickSearchFilteredCount: DEFAULT_QUICK_SEARCH_OPTIONS.filteredCount,
  enableColumnFiltering: false,
  columnFilteringDebounceMs: DEFAULT_COLUMN_FILTERING_OPTIONS.debounceMs,
  columnFilteringFilteredCount: DEFAULT_COLUMN_FILTERING_OPTIONS.filteredCount,
  enableColumnFilteringModel: false,
  enableQuickSearchModel: false,
  enablePagination: false,
  paginationInitialPageSize: DEFAULT_PAGE_SIZE,
  paginationPageSizes: DEFAULT_PAGE_SIZES,
  paginationRevertOnReject: true,
  enablePaginationModel: false,
  paginationModelInitialPageSize: DEFAULT_PAGE_SIZE,
  enableInfiniteScroll: false,
  enableBackToTop: false,
  enableDataExport: false,
  enableDataExportModel: false,
} as const
