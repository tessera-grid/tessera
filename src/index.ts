export { useCreateTable } from './v9/core/useCreateTable'

export {
  getActionColumnId,
  checkIsActionColumn,
  COLUMN_ACTIONS_SIZE,
} from './lib/core/createColumns/actionColumnParams'

// ID встроенных сервисных колонок — чтобы кастомный плагин мог таргетить их по id
export { COLUMN_SELECTION_ID } from './v9/plugins/rowSelection'
export { COLUMN_EXPANDING_ID } from './v9/plugins/rowExpanding'
export { COLUMN_DRAGGING_ID } from './v9/plugins/rowDragging'

// Реактивность v9 (ADR 0026, V9-2): собственный Pub-Sub (useSubscribeStore) убран —
// подписки на состояние идут через атомы TanStack Store.
export { useSlice, useTableState } from './v9/core/reactivity'
export { useCreateHooks, type PluginsHooks } from './v9/core/createHooks'

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
} from './v9/core/createState'

// Запись фичи Tessera (v9-аналог TablePlugin/RegistryEntry, ADR 0010).
export type { TesseraFeatureEntry as TablePlugin } from './v9/core/features'
export type {
  HeaderComponentProps,
  CellComponentProps,
} from './v9/core/createSlots'

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
} from './v9/core/headerActions'

export { DataGrid } from './v9/grid/DataGrid'
export { type DataGridProps } from './v9/grid/dataGridTypes'

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
