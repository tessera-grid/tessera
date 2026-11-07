export {
  useCreateTable,
  type UseCreateTableParams,
} from './lib/core/useCreateTable'
export type { TesseraFeatures } from './lib/core/features'
export type { SkeletonOptions } from './lib/core/skeletonOptions'
export type { FooterPosition } from './lib/core/footer'
export type { ActiveCell } from './lib/core/keyboardNavigation'
export type { RefreshOptions } from './lib/core/loadingDisplay'
export type {
  ColumnOption,
  ColumnOptionsDef,
  OptionValue,
} from './lib/core/columnOptions'

export {
  getActionColumnId,
  COLUMN_ACTIONS_SIZE,
} from './lib/core/createColumns/actionColumnParams'

// ID встроенных сервисных колонок — чтобы кастомный плагин мог таргетить их по id
export { COLUMN_SELECTION_ID } from './lib/plugins/rowSelection'
export { COLUMN_EXPANDING_ID } from './lib/plugins/rowExpanding'
export { COLUMN_DRAGGING_ID } from './lib/plugins/rowDragging'
export { ROW_ACTIONS_COLUMN_ID } from './lib/plugins/rowActions'

// Публичная подсветка строк, ячеек, колонок и диапазонов (ADR 0080, ADR 0152): `table.highlight`.
export type {
  FlashTarget,
  HighlightHandle,
  HighlightOptions,
  HighlightTarget,
  HighlightTone,
  RangeTarget,
} from './lib/core/highlights/highlightFeature'
// Транзакция строк (ADR 0157, ADR 0194): `table.applyRowTransaction` и `onDataChange`.
export type {
  RowTransaction,
  RowTransactionResult,
} from './lib/core/rowTransactions'
// Отмена длительных операций (ADR 0153): `table.cancelPending`.
export type { CancelPendingFilter, PendingKind } from './lib/core/cancellation'
// Ожидание и итог действия на ячейке (ADR 0176): `table.trackCellAction` и хук контрола.
export {
  useCellPending,
  type TrackCellActionOptions,
} from './lib/core/headerActions/cellActions'
// Реестр отказов (ADR 0177): `table.getFailures()`, `onFailure`, отметка ячейки.
export {
  useCellFailure,
  type Failure,
  type FailureReport,
  type FailureTarget,
} from './lib/core/failures/failuresFeature'
// Вспышка итога на цели асинхронного действия (ADR 0134): `table.flashOutcome`.
export type { FlashOutcome } from './lib/core/flashes/flashFeature'
// Прокрутка к строке (ADR 0104): `table.scrollToRow`.
export type {
  ScrollAlign,
  ScrollToRowOptions,
} from './lib/core/scrollToRow/scrollToRowFeature'

// Источник строк тела (ADR 0138): `table.getRowSource()`.
export type { RowSource, RowWindow } from './lib/core/rowSource'

// Реактивность: подписки на состояние идут через атомы TanStack Store.
export { useSlice, useTableState } from './lib/core/reactivity'

// Запись плагина, которую задаёт автор (ADR 0164).
export type { TablePlugin } from './lib/core/features'
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

// Авторский API плагина: definePlugin + типы пропсов компонентов. Каналы (hooks/state)
// definePlugin подмешивает в компонент пропсами, без кастов.
export {
  definePlugin,
  readPluginHooks,
  type PluginCellProps,
  type PluginHeaderProps,
  type PluginCellStateProps,
  type PluginCellOwnerProps,
} from './lib/core/definePlugin'
// Предикат из `refreshOn` при отрисовке — перерисовка по его ответу (ADR 0193).
export { usePredicateResult } from './lib/core/renderVersion'
// Вклад в тело грида для автора плагина: поле `body` у definePlugin (ADR 0173).
export type {
  PluginBody,
  PluginBodyEvents,
  PluginBodyEventTarget,
  PluginBodyOutput,
  PluginCellContext,
  PluginKeyContext,
  PluginKeyEvent,
  PluginKeysBody,
  PluginRootBody,
  PluginRootContext,
  PluginRootHookProps,
  PluginRowContext,
  PluginTargetBody,
} from './lib/core/bodyContributions'
// Канал действий грида: опция `onDebugAction`, `table.reportAction` и итог промиса (ADR 0125).
export {
  reportAction,
  reportOutcome,
  sourceOf,
  type ActionReport,
  type DebugAction,
  type DebugActionSource,
  type OnDebugAction,
} from './lib/core/debugActions'
// Первая загрузка для компонентов слотов: значения из данных — скелетом (ADR 0060, SL21).
export { isSkeletonShown } from './lib/core/skeletonOptions'
// Заглушки пустой таблицы: записи реестра для `definePlugin({ stubs })` и проп `stubs` (ADR 0123).
export type {
  StubAction,
  StubContext,
  StubEntry,
  StubId,
  StubRenderProps,
  StubsOverride,
} from './lib/core/stubs'

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
export {
  type DataGridProps,
  type DataGridTable,
} from './lib/grid/dataGridTypes'

// Тема: якорь-класс с дефолтами токенов `--tsr-comp-*` (переопределяемых извне
// обычным CSS), типы цветовой схемы и режима контраста.
export {
  DATA_GRID_THEME_CLASS,
  type ColorMode,
  type ContrastMode,
} from './lib/ui/theme'

export {
  type TableIcons,
  type IconComponent,
  DEFAULT_ICONS,
} from './lib/ui/icons'

export {
  type TableLabels,
  type LabelDictionary,
  type LabelSet,
  type PluginLabels,
  defineLabels,
  DEFAULT_LABELS,
  unknownLabelKeys,
} from './lib/core/localization'
