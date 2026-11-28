// Presence-based композиция: реестр распределён по плагинам, этот
// баррель собирает фабрики-примитивы для входа @tessera-grid/tessera/plugins.
// Центрального статического реестра нет — набор собирает потребитель импортами.

export { rowSelection, type RowSelectionOptions } from './rowSelection'
export {
  rowSelectionModel,
  type RowSelectionModelOptions,
} from './rowSelectionModel'
export type {
  RowSelectionAll,
  RowSelectionBranch,
  RowSelectionGroup,
  RowSelectionValue,
} from '../core/rowSelectionAll'
export { rowExpanding, type RowExpandingOptions } from './rowExpanding'
export {
  rowExpandingModel,
  type RowExpandingModelOptions,
} from './rowExpandingModel'
export { treeLines, type TreeLinesOptions } from './treeLines'
export {
  textWrap,
  type AutoHeight,
  type TextWrapColumnDef,
  type TextWrapOptions,
} from './textWrap'
export { rowDragging, type RowDraggingOptions } from './rowDragging'
export { rowGrouping, type RowGroupingOptions } from './rowGrouping'
export {
  rowGroupingModel,
  type RowGroupingModelOptions,
} from './rowGroupingModel'
export { rowActions, type RowActionsPluginOptions } from './rowActions'
export { cellEditing, type CellEditingOptions } from './cellEditing'
export { cellErrors, type CellErrorsOptions } from './cellErrors'
export {
  valueChangeFlash,
  type ValueChangeFlashColumnDef,
  type ValueChangeFlashOptions,
} from './valueChangeFlash'
export {
  cellSelection,
  type CellSelectionHandleOptions,
  type CellSelectionOptions,
  cellRangesToTsv,
  cellRangesToHtml,
  hasSelectedCells,
} from './cellSelection'
export {
  cellSelectionModel,
  type CellSelectionModelOptions,
} from './cellSelectionModel'
export { contextMenu, type ContextMenuOptions } from './contextMenu'

export {
  columnSorting,
  type ColumnSortingOptions,
  type ColumnMultiSortOptions,
} from './columnSorting'
export {
  columnSortingModel,
  type ColumnSortingModelOptions,
} from './columnSortingModel'
export { columnPinning, type ColumnPinningOptions } from './columnPinning'
export { columnSizing, type ColumnSizingOptions } from './columnSizing'
export { columnDragging, type ColumnDraggingOptions } from './columnDragging'
export {
  columnVisibility,
  type ColumnVisibilityOptions,
} from './columnVisibility'

export {
  headerActionMenu,
  type HeaderActionMenuOptions,
} from './headerActionMenu'
export { rowActionMenu, type RowActionMenuOptions } from './rowActionMenu'
export { pagination, type PaginationOptions } from './pagination'
export { paginationModel, type PaginationModelOptions } from './paginationModel'
export {
  infiniteScroll,
  type InfiniteScrollOptions,
  type InfiniteScrollLoadContext,
} from './infiniteScroll'
export { backToTop, type BackToTopOptions } from './backToTop'
export { columnTotals, type ColumnTotalsOptions } from './columnTotals'
export {
  columnAggregation,
  type ColumnAggregationColumnDef,
  type ColumnAggregationFunction,
  type ColumnAggregationOptions,
  type ColumnAggregationsState,
} from './columnAggregation'
export { failureLog, type FailureLogOptions } from './failureLog'
export { unsavedChanges, type UnsavedChangesOptions } from './unsavedChanges'
export {
  editHistory,
  type EditHistoryOptions,
  type AppHistoryEntry,
  type EditHistoryChange,
  type EditHistorySource,
  type EditHistoryEntry,
  type EditHistoryState,
} from './editHistory'
export {
  serverRowModel,
  type ServerRowModelOptions,
  type ServerRowModelHooks,
  type ServerRowTransaction,
  type ServerRowTransactionResult,
  type ServerRowsRequest,
  type ServerRowsResponse,
  type RefreshRowsOptions,
} from './serverRowModel'
export {
  columnFiltering,
  type ColumnFilteringOptions,
  type BooleanFilter,
  type ColumnFilterDef,
  type ColumnFilterType,
  type ColumnFilterValue,
  type NumberFilter,
  type NumberFilterOperator,
  type TextFilter,
  type TextFilterOperator,
} from './columnFiltering'
export {
  columnFilteringModel,
  type ColumnFilteringModelOptions,
} from './columnFilteringModel'
export { quickSearch, type QuickSearchOptions } from './quickSearch'
export {
  quickSearchModel,
  type QuickSearchModelOptions,
} from './quickSearchModel'
export {
  dataExport,
  exportFormats,
  type ExportOptions,
  type CsvFormatOptions,
  type XlsxFormatOptions,
  type ExportAllow,
  type ExportColumn,
  type ExportColumnDataType,
  type ExportContent,
  type ExportContext,
  type ExportColumns,
  type ExportData,
  type ExportFormat,
  type ExportPreset,
  type ExportRequest,
  type ExportRows,
  type ExportSettings,
  type ExportValueContext,
} from './dataExport'
export { dataExportModel, type DataExportModelOptions } from './dataExportModel'

// Контракт хуков для потребителя (types-mode b): слайсы как примитивы.
export type { ColumnDraggingHooks } from './columnDragging/types'
export type { ColumnPinningHooks } from './columnPinning/types'
export type { ColumnSizingHooks } from './columnSizing/types'
export type { ColumnSortingHooks } from './columnSorting/types'
export type { ColumnVisibilityHooks } from './columnVisibility/types'
export type { ExportHooks } from './dataExportModel/types'
export type { RowDragEnd, RowDraggingHooks } from './rowDragging/types'
export type { RowExpandingHooks } from './rowExpanding/types'
export type { RowSelectionHooks, SelectAllScope } from './rowSelection/types'
export type { PaginationHooks } from './pagination/types'
export type { InfiniteScrollHooks } from './infiniteScroll/types'
export type {
  CellEditingHooks,
  CellEditor,
  CellEditorProps,
  CellEditCancel,
  CellEditCommit,
  EditCancelReason,
  EditSession,
  CellEditingState,
  SubmittedCell,
} from './cellEditing/types'
export type { CellErrorsHooks } from './cellErrors/types'
export type { SessionCancelReason } from '../core/cancelInteraction'
export type {
  ServerActionContext,
  ServerActionResult,
} from '../core/serverActions'
export type { ToolbarPlacement } from '../shared/toolbarPlacement'
export {
  countViewSettingsValue,
  type ViewSettingsLevel,
  type ViewSettingsPanel,
  type ViewSettingsPanelProps,
  type ViewSettingsSection,
} from '../core/viewSettings'

// Types that public signatures reference (ADR 0113, DC7): the API reference links to them.
export type {
  CellsWritten,
  WrittenCell,
  WrittenMove,
  WrittenRow,
} from '../core/cellWrites'
export type { DataTypeName, DateCellValue } from '../core/dataTypes'
export type { ServiceColumnMode } from '../core/servicePresence'
export type { BackToTopLabels } from '../plugins/backToTop/labels'
export type { CellEditingLabels } from '../plugins/cellEditing/labels'
export type {
  ApplyOutcome,
  CellEditBatch,
  CellEditBatchResult,
  EditingCell,
  PendingPackage,
} from '../plugins/cellEditing/types'
export type { CellSelectionLabels } from '../plugins/cellSelection/labels'
export type { FillValue, ParseClipboard } from '../plugins/cellSelection/types'
export type { CellSelectionState } from '../plugins/cellSelectionModel/indexSelection'
export type { CellSelectionPredicateCell } from '../plugins/cellSelectionModel/registry'
export type { AggregationColumn } from '../plugins/columnAggregation/functions'
export type { ColumnAggregationLabels } from '../plugins/columnAggregation/labels'
export type { ColumnDraggingLabels } from '../plugins/columnDragging/labels'
export type { ColumnFilteringLabels } from '../plugins/columnFiltering/labels'
export type {
  DateFilter,
  EmptinessFilter,
  NumberBound,
  OptionFilter,
} from '../plugins/columnFilteringModel/types'
export type { ColumnPinningLabels } from '../plugins/columnPinning/labels'
export type { ColumnSizingLabels } from '../plugins/columnSizing/labels'
export type { ColumnSortingLabels } from '../plugins/columnSorting/labels'
export type { ColumnVisibilityLabels } from '../plugins/columnVisibility/labels'
export type { ContextMenuLabels } from '../plugins/contextMenu/labels'
export type { DataExportLabels } from '../plugins/dataExport/labels'
export type { DataExportModelLabels } from '../plugins/dataExportModel/labels'
export type { BuildXlsxOptions } from '../plugins/dataExportModel/xlsxBuild'
export type { EditHistoryApplied } from '../plugins/editHistory/history'
export type { EditHistoryLabels } from '../plugins/editHistory/labels'
export type { FailureLogLabels } from '../plugins/failureLog/labels'
export type { InfiniteScrollLabels } from '../plugins/infiniteScroll/labels'
export type { PaginationLabels } from '../plugins/pagination/labels'
export type { PageNumbersMode } from '../plugins/pagination/registry'
export type { QuickSearchLabels } from '../plugins/quickSearch/labels'
export type { RowActionsLabels } from '../plugins/rowActions/labels'
export type { RowDraggingLabels } from '../plugins/rowDragging/labels'
export type { RowExpandingLabels } from '../plugins/rowExpanding/labels'
export type { RowGroupingLabels } from '../plugins/rowGrouping/labels'
export type { RowSelectionLabels } from '../plugins/rowSelection/labels'
export type { RowSelectionModelLabels } from '../plugins/rowSelectionModel/labels'
export type { ServerRowModelLabels } from '../plugins/serverRowModel/labels'
export type { UnsavedChangesLabels } from '../plugins/unsavedChanges/labels'
export type { CalendarLabels } from '../shared/calendar/labels'
export type { CellErrorHook } from '../shared/cellHooks'
export type {
  FilterChangeHook,
  SearchChangeHook,
} from '../shared/filtering/filtering'
export type { FilteringLabels } from '../shared/filtering/labels'
export type { OptionsLabels } from '../shared/options/labels'
export type { ToolbarPlacementOption } from '../shared/toolbarPlacement'
export type { Preloadable } from '../util/preloadable'
export type { BuiltInDataType } from '../core/dataTypes'
export type { CellEditBatchItem } from '../plugins/cellEditing/types'
export type { CellSelectionRange } from '../plugins/cellSelectionModel/indexSelection'
export type { ColumnFilterEntry } from '../shared/filtering/filtering'
export type { DateFilterPreset } from '../plugins/columnFilteringModel/types'
export type { FillContext } from '../plugins/cellSelection/types'
export type { RowInsertBatchItem } from '../plugins/cellEditing/types'
export type { RowPlace } from '../core/cellWrites'
export type { SearchScope } from '../shared/filtering/filtering'
export type { BUILT_IN_DATA_TYPES } from '../core/dataTypes'
