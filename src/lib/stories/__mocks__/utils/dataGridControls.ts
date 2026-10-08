/**
 * Полная панель Controls историй DataGrid: каждая история на общей мете получает все
 * контролы по группам, сама задаёт только своё. Настройка фичи видна, пока фича
 * включена; форма мока — пока история не подаёт свои данные и колонки.
 */
import type { InputType } from 'storybook/internal/csf'

import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../../../lib/plugins/rowActions'
import { DEFAULT_SKELETON_OPTIONS } from '../../../../lib/core/skeletonOptions'
import {
  columnCountType,
  columnFilteringOptionsType,
  containerHeightType,
  dataCountType,
  dataNestingType,
  enableAnnouncementsType,
  enableCellEditingType,
  enableCellSelectionType,
  enableColumnDraggingType,
  enableColumnFilteringType,
  enableColumnPinningType,
  enableColumnResizingType,
  enableColumnSortingType,
  enableColumnVisibilityType,
  enableContextMenuType,
  enableExportType,
  enableFooterType,
  enableGroupingType,
  enableHeaderActionMenuType,
  enableKeyboardNavigationType,
  enableLeafPinningType,
  enableLoadingType,
  enableMultiSortType,
  enablePaginationType,
  enableQuickSearchType,
  enableRowActionMenuType,
  enableRowActionsType,
  enableRowDraggingType,
  enableRowExpandingType,
  enableRowSelectionType,
  enableSkeletonType,
  enableSortingRemovalType,
  enableStatusBarType,
  enableSubRowSelectionType,
  enableToolbarType,
  exportOptionsType,
  headerActionMenuOptionsType,
  headerNestingType,
  inCategory,
  multiSortOptionsType,
  numberHeightType,
  numberMaxHeightType,
  paginationPageSizeType,
  paginationPageSizesType,
  quickSearchOptionsType,
  rowActionMenuOptionsType,
  rowActionsColumnType,
  rowActionsDemoType,
  rowActionsOptionsType,
  rowDraggingEnableType,
  rowExpandingColumnType,
  rowExpandingMaxDepthType,
  rowExpandingTreeLinesType,
  serverColumnSortingType,
  showSelectedCountType,
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
const unless = (arg: string, type: InputType): InputType => ({
  ...type,
  if: { arg, exists: false },
})

export const dataGridArgTypes = {
  ...inCategory('Данные и размеры', {
    columnCount: columnCountType,
    dataCount: dataCountType,
    dataNesting: unless('dataOverride', dataNestingType),
    headerNesting: unless('columnsOverride', headerNestingType),
    containerHeight: containerHeightType,
    height: numberHeightType,
    maxHeight: numberMaxHeightType,
    showStub: showStubType,
  }),
  ...inCategory('Ядро: панели и состояния', {
    enableSkeleton: enableSkeletonType,
    ...when('enableSkeleton', { skeletonOptions: skeletonOptionsType }),
    enableLoading: enableLoadingType,
    enableFooter: enableFooterType,
    enableToolbar: enableToolbarType,
    enableStatusBar: enableStatusBarType,
    enableAnnouncements: enableAnnouncementsType,
  }),
  ...inCategory(
    'Колонки',
    {
      enableColumnSorting: enableColumnSortingType,
      ...when('enableColumnSorting', {
        enableSortingRemoval: enableSortingRemovalType,
        enableMultiSort: enableMultiSortType,
        multiSortOptions: multiSortOptionsType,
        serverColumnSorting: serverColumnSortingType,
      }),
    },
    'Сортировка',
  ),
  ...inCategory(
    'Колонки',
    {
      enableColumnPinning: enableColumnPinningType,
      ...when('enableColumnPinning', {
        enableLeafPinning: enableLeafPinningType,
      }),
    },
    'Закрепление',
  ),
  ...inCategory(
    'Колонки',
    {
      enableColumnResizing: enableColumnResizingType,
      enableColumnDragging: enableColumnDraggingType,
      enableColumnVisibility: enableColumnVisibilityType,
      enableHeaderActionMenu: enableHeaderActionMenuType,
      ...when('enableHeaderActionMenu', {
        headerActionMenuOptions: headerActionMenuOptionsType,
      }),
    },
    'Ширина, порядок, видимость',
  ),
  ...inCategory(
    'Строки',
    {
      enableRowSelection: enableRowSelectionType,
      ...when('enableRowSelection', {
        enableSubRowSelection: enableSubRowSelectionType,
        showSelectedCount: showSelectedCountType,
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
        rowExpandingTreeLines: rowExpandingTreeLinesType,
      }),
    },
    'Раскрытие',
  ),
  ...inCategory(
    'Строки',
    {
      enableRowDragging: enableRowDraggingType,
      ...when('enableRowDragging', {
        rowDraggingEnable: rowDraggingEnableType,
      }),
      enableGrouping: enableGroupingType,
    },
    'Порядок и группировка',
  ),
  ...inCategory(
    'Строки',
    {
      enableRowActions: enableRowActionsType,
      ...when('enableRowActions', {
        rowActionsDemo: rowActionsDemoType,
        rowActionsOptions: rowActionsOptionsType,
        rowActionsColumn: rowActionsColumnType,
      }),
      enableRowActionMenu: enableRowActionMenuType,
      ...when('enableRowActionMenu', {
        rowActionMenuOptions: rowActionMenuOptionsType,
      }),
    },
    'Действия',
  ),
  ...inCategory('Ячейки и клавиатура', {
    enableCellEditing: enableCellEditingType,
    enableCellSelection: enableCellSelectionType,
    enableContextMenu: enableContextMenuType,
    enableKeyboardNavigation: enableKeyboardNavigationType,
  }),
  ...inCategory('Поиск, фильтры, страницы, экспорт', {
    enableQuickSearch: enableQuickSearchType,
    ...when('enableQuickSearch', {
      quickSearchOptions: quickSearchOptionsType,
    }),
    enableColumnFiltering: enableColumnFilteringType,
    ...when('enableColumnFiltering', {
      columnFilteringOptions: columnFilteringOptionsType,
    }),
    enablePagination: enablePaginationType,
    ...when('enablePagination', {
      paginationPageSize: paginationPageSizeType,
      paginationPageSizes: paginationPageSizesType,
    }),
    enableExport: enableExportType,
    ...when('enableExport', { exportOptions: exportOptionsType }),
  }),
}

/**
 * Значения по умолчанию — те же, что у библиотеки без аргумента: история ведёт себя
 * как раньше. Раскладку (высоты) и флаги панелей (`auto` = не задано) не задаём.
 */
export const dataGridDefaultArgs = {
  dataNesting: 'flat',
  headerNesting: 'flat',
  showStub: false,

  enableSkeleton: false,
  skeletonOptions: DEFAULT_SKELETON_OPTIONS,
  enableLoading: false,
  enableFooter: false,
  enableAnnouncements: true,

  enableColumnSorting: false,
  enableSortingRemoval: true,
  enableMultiSort: true,
  serverColumnSorting: false,
  enableColumnResizing: false,
  enableColumnDragging: false,
  enableColumnPinning: false,
  enableLeafPinning: false,
  enableColumnVisibility: false,
  enableHeaderActionMenu: false,

  enableRowSelection: false,
  enableSubRowSelection: false,
  showSelectedCount: false,
  enableRowExpanding: false,
  rowExpandingMaxDepth: 1,
  rowExpandingColumn: 'auto',
  rowExpandingTreeLines: false,
  enableRowDragging: false,
  rowDraggingEnable: true,
  enableGrouping: false,
  enableRowActions: false,
  rowActionsDemo: true,
  rowActionsOptions: DEFAULT_ROW_ACTIONS_OPTIONS,
  rowActionsColumn: 'auto',
  enableRowActionMenu: false,

  enableCellEditing: false,
  enableCellSelection: false,
  enableContextMenu: false,
  enableKeyboardNavigation: false,

  enableQuickSearch: false,
  enableColumnFiltering: false,
  enablePagination: false,
  paginationPageSize: 25,
  enableExport: false,
} as const
