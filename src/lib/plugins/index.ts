// Presence-based композиция (ADR 0010): реестр распределён по плагинам, а этот
// баррель лишь собирает фабрики-примитивы для входа @mstrvtt/tessera/plugins.
// Центрального статического реестра нет — набор плагинов собирает потребитель тем,
// что импортирует.

export type { RegistryEntry, ServiceColumn, PluginOptions } from './types'

export { rowSelection, type RowSelectionOptions } from './rowSelection'
export { rowExpanding, type RowExpandingOptions } from './rowExpanding'
export { rowDragging } from './rowDragging'
export { rowGrouping } from './rowGrouping'

export { columnSorting, type ColumnSortingOptions } from './columnSorting'
export { columnPinning } from './columnPinning'
export { columnSizing } from './columnSizing'
export { columnDragging } from './columnDragging'
