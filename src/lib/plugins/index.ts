// Presence-based композиция: реестр распределён по плагинам, этот
// баррель собирает фабрики-примитивы для входа @mstrvtt/tessera/plugins.
// Центрального статического реестра нет — набор собирает потребитель импортами.

export { rowSelection, type RowSelectionOptions } from './rowSelection'
export { rowExpanding, type RowExpandingOptions } from './rowExpanding'
export { rowDragging, type RowDraggingOptions } from './rowDragging'
export { rowGrouping, type RowGroupingOptions } from './rowGrouping'
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
  type KeyboardNavigationOptions,
} from './keyboardNavigation'

export {
  columnSorting,
  type ColumnSortingOptions,
  type ColumnMultiSortOptions,
} from './columnSorting'
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

// Контракт хуков для потребителя (types-mode b): слайсы как примитивы.
export type { ColumnDraggingHooks } from './columnDragging/types'
export type { ColumnPinningHooks } from './columnPinning/types'
export type { ColumnSizingHooks } from './columnSizing/types'
export type { ColumnSortingHooks } from './columnSorting/types'
export type { ColumnVisibilityHooks } from './columnVisibility/types'
export type { RowDraggingHooks } from './rowDragging/types'
export type { RowExpandingHooks } from './rowExpanding/types'
export type { RowSelectionHooks } from './rowSelection/types'
export type { PaginationHooks } from './pagination/types'
export type {
  CellEditingHooks,
  CellEditor,
  CellEditCancel,
  EditCancelReason,
  EditSession,
} from './cellEditing/types'
export type { SessionCancelReason } from '../core/cancelInteraction'
