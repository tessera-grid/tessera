export {
  useCreateTable,
  type UseCreateTableParams,
} from './lib/core/useCreateTable'
export type { TesseraFeatures } from './lib/core/features'
export type { SkeletonOptions } from './lib/core/skeletonOptions'

export {
  getActionColumnId,
  COLUMN_ACTIONS_SIZE,
} from './lib/core/createColumns/actionColumnParams'

// ID встроенных сервисных колонок — чтобы кастомный плагин мог таргетить их по id
export { COLUMN_SELECTION_ID } from './lib/plugins/rowSelection'
export { COLUMN_EXPANDING_ID } from './lib/plugins/rowExpanding'
export { COLUMN_DRAGGING_ID } from './lib/plugins/rowDragging'

// Реактивность: подписки на состояние идут через атомы TanStack Store.
export { useSlice, useTableState } from './lib/core/reactivity'

export {
  useColumnOrderState,
  useColumnPinningState,
  useRowSelectionState,
  useColumnSizingState,
  useExpandedState,
  useSortingState,
  useColumnVisibilityState,
  useGroupingState,
} from './lib/core/createState'

// Запись фичи Tessera (экспортируется как TablePlugin).
export type { TesseraFeatureEntry as TablePlugin } from './lib/core/features'
export type {
  HeaderComponentProps,
  CellComponentProps,
  ToolbarComponentProps,
  PluginSlot,
} from './lib/core/createSlots'
export type { ServiceColumn } from './lib/core/createColumns'
export type {
  KeyboardAction,
  CellKeyboardAction,
  HeaderKeyboardAction,
} from './lib/core/keyboardActions'
export type {
  PluginDiagnostic,
  PluginDiagnose,
  PluginInertReason,
} from './lib/core/pluginDiagnostics'

// Авторский API плагина: definePlugin + инъекторы каналов (hooks/state) +
// типы пропсов компонентов. Каналы приходят в компонент пропсами, без кастов.
export {
  definePlugin,
  readPluginHooks,
  injectCellHooks,
  injectHeaderHooks,
  injectCellState,
  injectCellOwner,
  type PluginCellProps,
  type PluginHeaderProps,
  type PluginCellStateProps,
  type PluginCellOwnerProps,
} from './lib/core/definePlugin'

// Единый дескриптор действия слота (кебаб-меню): плагины объявляют действия
// данными, ядро решает подачу (инлайн-кнопка или строка меню). `SlotAction<TCtx>`
// — обобщённый дескриптор; `HeaderAction`/`RowAction` — псевдонимы под контекст.
export type {
  SlotAction,
  SlotName,
  HeaderAction,
  RowAction,
  ActionMenuDeclaration,
  ContextMenuAction,
  ContextMenuContext,
} from './lib/core/headerActions'

export { DataGrid } from './lib/grid/DataGrid'
export { type DataGridProps } from './lib/grid/dataGridTypes'

// Тема: якорь-класс с дефолтами токенов `--tsr-comp-*` (переопределяемых извне
// обычным CSS) и тип цветовой схемы.
export {
  DATA_GRID_THEME_CLASS,
  type ColorMode,
} from './lib/core/themeVariables'

export {
  type TableIcons,
  type IconComponent,
  DEFAULT_ICONS,
} from './lib/ui/icons'

export { type TableLabels, DEFAULT_LABELS } from './lib/core/localization'
