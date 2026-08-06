export { useCreateTable } from './lib/core/createTable'

export {
  getActionColumnId,
  checkIsActionColumn,
  COLUMN_ACTIONS_SIZE,
} from './lib/core/createColumns/actionColumnParams'

// ID встроенных сервисных колонок — чтобы кастомный плагин мог таргетить их по id
export { COLUMN_SELECTION_ID } from './lib/plugins/rowSelection'
export { COLUMN_EXPANDING_ID } from './lib/plugins/rowExpanding'
export { COLUMN_DRAGGING_ID } from './lib/plugins/rowDragging'

export { useSubscribeStore } from './lib/core/subscribeStore/subscribeStore'
export { useCreateHooks, type PluginsHooks } from './lib/core/createHooks'

export {
  useColumnOrderState,
  useColumnPinningState,
  useRowSelectionState,
  useColumnSizingState,
  useRowExpandingState,
  useColumnSortingState,
  useColumnVisibilityState,
  useRowGroupingState,
  stateUpdater,
} from './lib/core/createState'

export type {
  TablePlugin,
  HeaderComponentProps,
  CellComponentProps,
} from './lib/plugins/types'

export { DataGrid } from './lib/grid/DataGrid/DataGrid'
export { type DataGridProps } from './lib/grid/DataGrid/types'

export {
  type TableIcons,
  type SvgIconProps,
  DEFAULT_ICONS,
} from './lib/ui/icons'

export { type TableLabels, DEFAULT_LABELS } from './lib/core/localization'
