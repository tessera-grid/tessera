// Presence-based композиция (ADR 0010): реестр распределён по плагинам, а этот
// баррель лишь собирает фабрики-примитивы для входа @mstrvtt/tessera/plugins.
// Центрального статического реестра нет — набор плагинов собирает потребитель тем,
// что импортирует.

export type { RegistryEntry, ServiceColumn, PluginOptions } from './types'

// Контракт хуков для потребителя (types-mode b, ADR 0010): агрегат всех встроенных
// слайсов + сами слайсы как примитивы композиции.
export type {
  BuiltinPluginsHooks,
  ColumnDraggingPlugin,
  ColumnPinningPlugin,
  ColumnSizingPlugin,
  ColumnSortingPlugin,
  RowDraggingPlugin,
  RowExpandingPlugin,
  RowSelectionPlugin,
} from './hooks'

export { rowSelection, type RowSelectionOptions } from './rowSelection'
export { rowExpanding, type RowExpandingOptions } from './rowExpanding'
export { rowDragging } from './rowDragging'
export { rowGrouping } from './rowGrouping'
export { rowActions, type RowActionsPluginOptions } from './rowActions'

export { columnSorting, type ColumnSortingOptions } from './columnSorting'
export { columnPinning } from './columnPinning'
export { columnSizing } from './columnSizing'
export { columnDragging } from './columnDragging'

export {
  headerActionMenu,
  type HeaderActionMenuOptions,
} from './headerActionMenu'

export { rowActionMenu, type RowActionMenuOptions } from './rowActionMenu'
