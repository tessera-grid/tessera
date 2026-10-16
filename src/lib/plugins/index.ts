// Presence-based композиция: реестр распределён по плагинам, этот
// баррель собирает фабрики-примитивы для входа @tessera-grid/tessera/plugins.
// Центрального статического реестра нет — набор собирает потребитель импортами.

export { rowSelection, type RowSelectionOptions } from './rowSelection'
export {
  rowSelectionModel,
  type RowSelectionModelOptions,
} from './rowSelectionModel'
export { rowExpanding, type RowExpandingOptions } from './rowExpanding'
export {
  rowExpandingModel,
  type RowExpandingModelOptions,
} from './rowExpandingModel'
export { treeLines, type TreeLinesOptions } from './treeLines'
export { rowDragging, type RowDraggingOptions } from './rowDragging'
export { rowGrouping, type RowGroupingOptions } from './rowGrouping'
export {
  rowGroupingModel,
  type RowGroupingModelOptions,
} from './rowGroupingModel'
export { rowActions, type RowActionsPluginOptions } from './rowActions'
export { cellEditing, type CellEditingOptions } from './cellEditing'
export {
  cellSelection,
  type CellSelectionOptions,
  cellRangesToTsv,
  cellRangesToHtml,
  hasSelectedCells,
} from './cellSelection'
export { contextMenu, type ContextMenuOptions } from './contextMenu'
export {
  keyboardNavigation,
  type ActiveCell,
  type KeyboardNavigationOptions,
} from './keyboardNavigation'

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
  type ExportColumnFilter,
  type ExportContent,
  type ExportColumns,
  type ExportData,
  type ExportFormat,
  type ExportPreset,
  type ExportRequest,
  type ExportRows,
  type ExportSettings,
  type ExportValueContext,
} from './dataExport'

// Контракт хуков для потребителя (types-mode b): слайсы как примитивы.
export type { ColumnDraggingHooks } from './columnDragging/types'
export type { ColumnPinningHooks } from './columnPinning/types'
export type { ColumnSizingHooks } from './columnSizing/types'
export type { ColumnSortingHooks } from './columnSorting/types'
export type { ColumnVisibilityHooks } from './columnVisibility/types'
export type { ExportHooks } from './dataExport/types'
export type { RowDragEnd, RowDraggingHooks } from './rowDragging/types'
export type { RowExpandingHooks } from './rowExpanding/types'
export type { RowSelectionHooks } from './rowSelection/types'
export type { PaginationHooks } from './pagination/types'
export type { InfiniteScrollHooks } from './infiniteScroll/types'
export type {
  CellEditingHooks,
  CellEditor,
  CellEditCancel,
  CellEditCommit,
  EditCancelReason,
  EditSession,
  CellEditingState,
  SubmittedCell,
} from './cellEditing/types'
export type { SessionCancelReason } from '../core/cancelInteraction'
export type {
  ServerActionContext,
  ServerActionResult,
} from '../core/serverActions'
