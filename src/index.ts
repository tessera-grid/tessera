export { useCreateTable } from './lib/core/useCreateTable'

export {
  getActionColumnId,
  checkIsActionColumn,
  COLUMN_ACTIONS_SIZE,
} from './lib/core/createColumns/actionColumnParams'

// ID встроенных сервисных колонок — чтобы кастомный плагин мог таргетить их по id
export { COLUMN_SELECTION_ID } from './lib/plugins/rowSelection'
export { COLUMN_EXPANDING_ID } from './lib/plugins/rowExpanding'
export { COLUMN_DRAGGING_ID } from './lib/plugins/rowDragging'

// Реактивность v9 (ADR 0026, V9-2): собственный Pub-Sub (useSubscribeStore) убран —
// подписки на состояние идут через атомы TanStack Store.
export { useSlice, useTableState } from './lib/core/reactivity'

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

// Запись фичи Tessera (v9-аналог TablePlugin/RegistryEntry, ADR 0010).
export type { TesseraFeatureEntry as TablePlugin } from './lib/core/features'
export type {
  HeaderComponentProps,
  CellComponentProps,
} from './lib/core/createSlots'

// Авторский API плагина (ADR 0028): definePlugin + инъекторы каналов (hooks/state) +
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
  SlotActions,
  HeaderActionSlot,
  SlotMenuConfig,
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
  type SvgIconProps,
  DEFAULT_ICONS,
} from './lib/ui/icons'

export { type TableLabels, DEFAULT_LABELS } from './lib/core/localization'
