// Presence-based композиция (ADR 0010): реестр распределён по плагинам, этот
// баррель собирает фабрики-примитивы для входа @mstrvtt/tessera/plugins (v9).
// Центрального статического реестра нет — набор собирает потребитель импортами.

export { rowSelection, type RowSelectionOptions } from './rowSelection'
export {
  rowExpanding,
  DEFAULT_MAX_EXPANDING_DEPTH,
  type RowExpandingOptions,
} from './rowExpanding'
export { rowDragging, type RowDraggingOptions } from './rowDragging'
export { rowGrouping, type RowGroupingOptions } from './rowGrouping'
export { rowActions, type RowActionsPluginOptions } from './rowActions'

export {
  columnSorting,
  type ColumnSortingOptions,
  type ColumnMultiSortOptions,
} from './columnSorting'
export { columnPinning, type ColumnPinningOptions } from './columnPinning'
export { columnSizing, type ColumnSizingOptions } from './columnSizing'
export { columnDragging, type ColumnDraggingOptions } from './columnDragging'

export {
  headerActionMenu,
  type HeaderActionMenuOptions,
} from './headerActionMenu'
export { rowActionMenu, type RowActionMenuOptions } from './rowActionMenu'

// Контракт хуков для потребителя (types-mode b, ADR 0010): слайсы как примитивы.
export type { ColumnDraggingPlugin } from './columnDragging/types'
export type { ColumnPinningPlugin } from './columnPinning/types'
export type { ColumnSizingHooks } from './columnSizing/types'
export type { ColumnSortingPlugin } from './columnSorting/types'
export type { RowDraggingPlugin } from './rowDragging/types'
export type { RowExpandingHooks } from './rowExpanding/types'
export type { RowSelectionHooks } from './rowSelection/types'
