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

// Единый дескриптор действия слота (кебаб-меню): плагины объявляют действия
// данными, ядро решает подачу (инлайн-кнопка или строка меню). `SlotAction<TCtx>`
// — обобщённый дескриптор; `HeaderAction`/`RowAction` — псевдонимы под контекст.
export type {
  SlotAction,
  SlotName,
  HeaderAction,
  RowAction,
  SlotActions,
  HeaderActionSlot,
  SlotMenuConfig,
} from './lib/core/headerActions'

export { DataGrid } from './lib/grid/DataGrid/DataGrid'
export { type DataGridProps } from './lib/grid/DataGrid/types'

// Тема: якорь-класс с дефолтами токенов `--tsr-comp-*` (переопределяемых извне
// обычным CSS) и тип цветовой схемы.
export {
  DATA_GRID_THEME_CLASS,
  type ColorMode,
} from './lib/core/themeVariables'

export {
  type TableIcons,
  type SvgIconProps,
  DEFAULT_ICONS,
} from './lib/ui/icons'

export { type TableLabels, DEFAULT_LABELS } from './lib/core/localization'
