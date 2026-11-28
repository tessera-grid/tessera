/**
 * Тип-контракт `commonFeature` (always-on). Здесь ТОЛЬКО типы (declaration merging
 * в feature-карты v9 + интерфейсы API); рантайм-реализация — `commonFeature.ts`.
 *
 * Почему через `*_FeatureMap`, а не прямым расширением `Table`/`Column`: в v9 API
 * фичи объявляются в её карте под ключом фичи, что даёт feature-gated типы (метод
 * существует в типах ровно когда фича включена). Для `HeaderGroup` карты нет —
 * используем прямой merge интерфейса (эскейп).
 */
import type { DayPickerLocale } from '@daypicker/react'
import type { KeyboardPlatformOption } from './keyboardPlatform'
import type { ColumnOptionsDef } from './columnOptions'
import type { ServiceColumnInfo } from './createColumns'
import type {
  DataTypeFields,
  DataTypeName,
  DataTypeRegistry,
  ResolvedDataType,
} from './dataTypes'
import type { DataMode } from './dataMode'
import type { Failure } from './failures/failuresFeature'
import type { ActionReport, OnDebugAction } from './debugActions'
import type { SkeletonCellKind } from './skeletonOptions'
import type { RowSource } from './rowSource'
import type {
  ColumnSizingState,
  OnChangeFn,
  Row,
  RowData,
  TableFeature,
  TableFeatures,
  Updater,
} from '@tanstack/react-table'

import type { RenderSlots } from './createSlots'
import type {
  ContextMenuAction,
  SlotActionMenu,
  SlotActions,
} from './headerActions'
import type { KeyboardAction } from './keyboardActions'
import type { ColumnTransform } from './columnTransforms'
import type { ViewSettingsSection } from './viewSettings'
import type { ToolbarPlacement } from './toolbar'
import type { ActiveCell } from './keyboardNavigation/model'
import type { Draft, DraftKind } from './drafts/drafts'
import type { LabelSet } from './localization'
import type { ActionCatalog, ActionRef } from './actions'
import type {
  PluginDiagnostic,
  PluginDiagnosticSource,
} from './pluginDiagnostics'
import type { SkeletonOptions } from './skeletonOptions'
import type { FooterPosition } from './footer'
import type { StubEntry } from './stubs'
import type { FoldedWrappers } from './pluginWrappers'
import type { FoldedBody } from './bodyContributions'
import type { RenderVersionAtom } from './renderVersion'
import type { NarrowContext, NarrowMap } from './effectiveState'
import type { RefreshOptions } from './loadingDisplay'
import type { RowTransaction, RowTransactionResult } from './rowTransactions'
import type {
  CellWrite,
  CellWriteOptions,
  CellWriteReport,
  CellWriter,
  CellsWritten,
  RowMover,
  WriteLimits,
} from './cellWrites'

// --- Payload-типы контракта --------------------------------------------------
/** Бизнес-контракт хуков. */
export type CommonHooks = Record<string, unknown>
/** Слоты рендера. Псевдоним сохранён для стабильности импортов. */
export type RenderSlotsV9 = RenderSlots
/** Действия слотов. */
export type SlotActionsV9 = SlotActions
/** Карта конфигов схлопывания по слотам. */
export type SlotActionMenuV9 = SlotActionMenu

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

// --- Опции фичи --------------------------------------------------------------
/** Core options the application sets in `useCreateTable` (ADR 0164). */
export interface CoreOptions {
  /**
   * Where row operations run (ADR 0169): `'client'`, `'server'`, or per operation: `sorting`,
   * `filtering`, `search`, `pagination`, `export`; an operation not set runs on the client.
   * Read once at mount.
   */
  dataMode?: DataMode
  /**
   * Rows on the server for the current query (ADR 0169, §4), after filters and search; `-1`
   * means unknown. The pager, server row model, infinite scroll, `aria-rowcount` and "showing N
   * of M" read it through the core (`rowCountOf`).
   */
  rowCount?: number
  /** Rows on the server before filters and search — for "showing N of M". */
  totalRowCount?: number
  /** Language of word forms, numbers and lists in labels (BCP 47), `en-US` by default (ADR 0169, §5). */
  locale?: string
  /**
   * Limits of one cell write operation (ADR 0223): above `confirm` the user is asked, above
   * `max` it is refused; 5,000 and 15,000 by default, `false` means no limits.
   */
  writeLimits?: WriteLimits | false
  /** Custom column data types and overrides of built-in type fields (ADR 0172, §1). */
  dataTypes?: DataTypeRegistry
  /**
   * Time zone for dates (IANA or `'UTC'`): days, "today", presets and wall-clock time of the
   * date filter and export; the browser's zone by default (ADR 0169, §5).
   */
  timeZone?: string
  /**
   * Language of date calendars — months, weekdays, first day of the week: a `date-fns` `Locale`
   * object; `en-US` by default. Read by the date filter and the date editor (ADR 0175).
   */
  dateLocale?: DayPickerLocale
  /**
   * Data loading state (ADR 0106): `'initial'` shows the first-load skeleton (ADR 0060),
   * `'refresh'` shows the refresh glow (ADR 0094), `false` means not loading.
   */
  loading?: 'initial' | 'refresh' | false
  enableFooter?: boolean
  /**
   * Footer row position (ADR 0118): `'pinned'` stays at the bottom of the scroll area,
   * `'inline'` follows the last row and scrolls with the body.
   */
  footerPosition?: FooterPosition
  /** Top toolbar: unset — shown when plugins add buttons, `true` — always, `false` — never (ADR 0046). */
  enableToolbar?: boolean
  /** Position of the "View settings" button in the toolbar; `false` hides it (ADR 0215, §2). */
  viewSettingsToolbar?: ToolbarPlacement | false
  /** Status bar: unset — shown when it has slots, `true` — always, `false` — never (ADR 0046). */
  enableStatusBar?: boolean
  /** `false` — the core doesn't announce changes to screen readers (ADR 0032, W9). */
  enableAnnouncements?: boolean
  /**
   * Keyboard navigation between cells (ADR 0021, ADR 0170): the `grid` (`treegrid`) role, roving
   * `tabindex` and keys; without it the grid is `role="table"`.
   */
  enableKeyboardNavigation?: boolean
  /**
   * Keyboard platform (ADR 0232, KX11): `apple` uses `Cmd` as the primary modifier, `other` uses
   * `Ctrl`; `auto` (default) detects it from the browser.
   */
  keyboardPlatform?: KeyboardPlatformOption
  /** Active cell controlled by the application — display indexes (KN31, ADR 0171, §4). */
  activeCell?: ActiveCell
  /** The active cell changed — by arrows, click or Tab. */
  onActiveCellChange?: (next: ActiveCell) => void
  /** Active cell at mount, when the application doesn't control it (EF10). */
  initialActiveCell?: ActiveCell
  /** Drafts controlled by the application (ADR 0178, §1): entered but not applied. */
  drafts?: readonly Draft[]
  /** Drafts changed — from inside the grid or through the table API. */
  onDraftsChange?: (next: readonly Draft[]) => void
  /** Drafts at mount, when the application doesn't control them. */
  initialDrafts?: readonly Draft[]
  /** `false` — no tooltip on truncated cell text (ADR 0075). */
  enableOverflowTooltip?: boolean
  /** `false` — row model changes are instant, without motion (ADR 0107). */
  enableRowAnimation?: boolean
  /** `false` — column order changes are instant, without motion (ADR 0115). */
  enableColumnAnimation?: boolean
  /**
   * `false` — the first render and a whole-window change happen in one pass, without React
   * transitions: for an application with `<ViewTransition>` above the grid (ADR 0203).
   */
  enableIncrementalRender?: boolean
  skeletonOptions?: SkeletonOptions
  /** Delay and minimum display time of the refresh state with `loading: 'refresh'` (ADR 0094). */
  refreshOptions?: RefreshOptions
  /**
   * Data load failure (ADR 0096): an `Error` or a string; `null` means no error. With data —
   * a red light under the header and an alert; without data — the error stub.
   */
  loadError?: unknown
  /** Retries loading from the alert and the stub; a promise keeps the button pending. */
  onRetry?: () => unknown
  /** The grid's debug-action channel: what the user, the application or the grid did (ADR 0125). */
  onDebugAction?: OnDebugAction
  /** A new failure in the failure registry (ADR 0177, §6) — for example, for your error tracker. */
  onFailure?: (failure: Failure) => void
  /**
   * The next `data` of a client transaction `table.applyRowTransaction` (ADR 0194, §4): the
   * application puts it into `data`. Without a handler, a transaction is not applied in client
   * mode.
   */
  onDataChange?: (data: any[], transaction: RowTransaction) => void
  /** Height of body, footer and skeleton rows, px; 50 by default, at least 40 (ADR 0077). */
  rowHeight?: number
  /** Height of each header row, px; same as `rowHeight` by default, at least 36. */
  headerHeight?: number
}

/** Опции `commonFeature`: опции ядра и каналы сборки и плагинов (ADR 0164). */
/** Итог колонки в ячейке футера — сторожу вспышки (ADR 0221, §9). */
export interface ColumnTotalWatch {
  table: unknown
  columnId: string
  total: unknown
  /** Прежний итог; при монтировании ячейки — `undefined`. */
  previous: unknown
  mounted: boolean
  /** Ячейка футера: видна ли она в области прокрутки. */
  element: HTMLElement | null
}

export interface CommonOptions extends CoreOptions {
  /**
   * Значение ячейки для отрисовки, которого строка ещё не несёт: стадия переноса между группами
   * (ADR 0186, §3; ADR 0200, §4). `undefined` — значение строки.
   */
  cellValueOverride?: (cell: unknown) => { value: unknown } | undefined
  /** `false` — без числа строк в строке группы (ADR 0184, §8). */
  groupRowCount?: boolean
  /**
   * Оценка высоты незамеренной строки, px: строки разной высоты по содержимому (ADR 0218, §6).
   * Ставит плагин `textWrap`; нет — строки одной высоты.
   */
  estimatedRowHeight?: number
  /** Итог колонки на клиенте: с ним футер есть без флага (ADR 0184, §4, §7). */
  columnTotalOf?: (table: unknown, columnId: string) => unknown
  /**
   * Сторож итога колонки (ADR 0221, §9): ячейка футера зовёт его при монтировании и при смене
   * итога; ставит плагин valueChangeFlash.
   */
  watchColumnTotal?: (watch: ColumnTotalWatch) => void
  /** Имя функции итога колонки перед числом (ADR 0230, §4); ставит плагин columnAggregation. */
  columnTotalLabel?: (table: unknown, columnId: string) => string | undefined
  hooks?: CommonHooks
  slots?: RenderSlotsV9
  slotActions?: SlotActionsV9
  contextMenuActions?: ContextMenuAction[]
  /** Заглушки пустой таблицы плагинов (ADR 0123). */
  stubEntries?: StubEntry[]
  /** Виды черновиков включённых плагинов (ADR 0178, §1). */
  draftKinds?: DraftKind[]
  /** Подписи плагинов таблицы (ADR 0182, §8). */
  labelSets?: LabelSet[]
  /** Справочник действий таблицы (ADR 0182, §1). */
  actionCatalog?: ActionCatalog
  keyboardActions?: KeyboardAction[]
  /** Преобразования колонок плагинов: вид, состояние и снятие (ADR 0204, §2). */
  columnTransforms?: ColumnTransform[]
  /** Разделы «Настроек вида» плагинов (ADR 0215, §5). */
  viewSettingsSections?: ViewSettingsSection[]
  pluginDiagnostics?: PluginDiagnosticSource[]
  actionMenu?: SlotActionMenuV9
  logLevel?: LogLevel
  /** Атом номера перерисовки ячеек: растёт при новой функции-аргументе плагина (ADR 0039, ADR 0171). */
  pluginRenderVersion?: RenderVersionAtom
  /** Обёртки и декораторы тела и шапки от плагинов (ADR 0168, §2). */
  pluginWrappers?: FoldedWrappers
  /** Вклад плагинов в тело грида и клавиши навигации (ADR 0170, §3). */
  pluginBody?: FoldedBody
  /** Сужения срезов по ключу — их читает атом-линза среза (ADR 0171, §1). */
  pluginNarrows?: NarrowMap
  /** Свёртка набора для сужения: опции и действия слотов (ADR 0171, §1). */
  pluginNarrowContext?: NarrowContext
  /** Сохранённое значение среза, до сужения (ADR 0054, §5). */
  pluginSavedSlice?: (key: string) => unknown
  /**
   * Строк данных на сервере для `aria-rowcount`; `-1` — итог неизвестен,
   * `undefined` — строк столько, сколько в `data` (ADR 0081).
   */
  getTotalRowCount?: (table: unknown) => number | undefined
  /** Свой источник строк тела (серверная модель строк, ADR 0138); один объект на таблицу. */
  getRowSource?: (table: unknown) => RowSource
  /**
   * Слой поверх источника строк (ADR 0178, §7): строки до сохранения показывает он, а не
   * модель строк. Нечего показать — тот же источник.
   */
  rowSourceLayer?: (source: RowSource, table: unknown) => RowSource
  /** Исполнитель записи в ячейки — плагин правки (ADR 0219, §1). */
  cellWriter?: CellWriter
  /** Слушатель итогов записи в ячейки — плагин истории (ADR 0222, §2). */
  cellsWritten?: (table: unknown, record: CellsWritten) => void
  /** Исполнитель переноса строки — плагин перетаскивания строк (ADR 0222, §13). */
  rowMover?: RowMover
  /** Тело ждёт данных плагина: `aria-busy` таблицы (ADR 0081). */
  getBodyBusy?: (state: object) => boolean
  /** В `data` загружена только часть строк сервера (лента, ADR 0081). */
  partialData?: boolean
  /** Строки показаны страницами модели пагинации (ADR 0169, §6). */
  pagedRows?: boolean
  /** Строки — дерево модели раскрытия (ADR 0168, §4; ADR 0170, §2). */
  treeRows?: boolean
  /** Строки — группы модели группировки. */
  groupRows?: boolean
  /** Строки групп держатся под шапкой, пока видны их дети (ADR 0160, §3; ADR 0170, §2). */
  stickyGroupRows?: boolean
  /** Строки веток дерева держатся под шапкой, пока видны их дети. */
  stickyBranchRows?: boolean
  /** `rowCount` приложения как есть: стоковый `rowCount` ядро задаёт только страницам с сервера. */
  serverRowCount?: number
  /** Новая `data` только дописывает строки в конец прежней (лента, ADR 0145). */
  appendOnlyData?: boolean
  /** Writer авто-слайса размеров (generic-механизм). */
  onColumnAutoSizingChange?: OnChangeFn<ColumnSizingState>
  /** Writer флекс-ширин: их считает грид по ширине области (ADR 0216). */
  onColumnFlexSizingChange?: OnChangeFn<ColumnSizingState>
  /** Пользовательский срез ширин без флекс-ширин и служебных (ADR 0216, §3). */
  columnUserSizing?: ColumnSizingState
}

// --- Публичные API по объектам таблицы ---------------------------------------
export interface CommonTableAPI<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> {
  /** Строки тела по индексу и по id (ADR 0138, §2). */
  getRowSource: () => RowSource<Row<TFeatures, TData>>
  /** Итог колонки: ответа сервера или плагина `columnTotals`; нет — `undefined`. */
  getColumnTotal: (columnId: string) => unknown
  /**
   * Добавить, обновить и удалить строки (ADR 0157, ADR 0194): с серверной моделью — в её
   * кэше, в клиентском режиме — следующим `data` через `onDataChange`.
   */
  applyRowTransaction: (
    transaction: RowTransaction<TData>,
  ) => RowTransactionResult
  /**
   * Записать в ячейки (ADR 0219, §1) по правилам правки — `canEditCell`, разбор текста по
   * типу, `validate` — одним пакетом или черновиками; без плагина правки — `undefined`.
   */
  writeCells: (
    changes: readonly CellWrite[],
    options?: CellWriteOptions,
  ) => Promise<CellWriteReport> | undefined
  getHooks: () => CommonHooks | undefined
  /** Подпись действия справочника по текущему словарю таблицы (ADR 0182, AN8). */
  getActionLabel: (action: ActionRef) => string
  getRenderSlots: () => RenderSlotsV9 | undefined
  getSlotActions: () => SlotActionsV9 | undefined
  getContextMenuActions: () => ContextMenuAction[] | undefined
  getKeyboardActions: () => KeyboardAction[] | undefined
  /** Активен или инертен (и почему) каждый подключённый плагин — на момент вызова. */
  getPluginDiagnostics: () => PluginDiagnostic[]
  /** Зарегистрировать ошибку плагина: лог + статус `error` в снимке (ADR 0037). */
  reportPluginError: (pluginId: string, error: unknown) => void
  getIsAnyColumnResizing: () => boolean
  setColumnAutoSizing: (updater: Updater<ColumnSizingState>) => void
  /** Записать флекс-ширины (ADR 0216); пишет грид по ширине области. */
  setColumnFlexSizing: (updater: Updater<ColumnSizingState>) => void
  /** Записать нижние границы флекс-колонок по содержимому (ADR 0217, §3). */
  setColumnFlexMinSizing: (updater: Updater<ColumnSizingState>) => void
  /** Объявить текст скринридеру через live-область грида. */
  announce: (message: string) => void
  /** Сообщить действие в канал `onDebugAction` (ADR 0125); номер действия или `undefined`. */
  reportAction: (report: ActionReport) => number | undefined
}

export interface CommonColumnAPI {
  /** Колонка — служебная: её вставило ядро по записи плагина (ADR 0165). */
  getIsActionsColumn: () => boolean
  /** Сведения служебной колонки; у колонки приложения — `undefined`. */
  getServiceColumn: () => ServiceColumnInfo | undefined
  /** Тип данных колонки: имя, базовый тип и итоговое определение; без типа — `undefined` (ADR 0172). */
  getDataType: () => ResolvedDataType | undefined
}

/** Кастомные поля columnDef Tessera; `options` / `getOptionLabel` — ADR 0048. */
export interface CommonColumnDef<TData = any>
  extends ColumnOptionsDef, Omit<DataTypeFields<TData>, 'parseValue'> {
  /** Тип данных колонки: встроенный или из реестра `dataTypes` (ADR 0172). */
  dataType?: DataTypeName
  /** Свой разбор текста редактора, главнее `dataType` (ADR 0139). */
  parseValue?: (text: string, row: TData) => unknown
  /**
   * Вес флекс-колонки (ADR 0216): колонка делит свободную ширину таблицы с другими флекс-колонками
   * в пределах `minSize`/`maxSize`; `size` не учитывается.
   */
  flex?: number
  /**
   * Ячейка колонки в скелетах (ADR 0060, SL18): `'bar'` — полоска, `'control'` —
   * квадрат контрола, `'toggle'` — переключатель на строках дерева с детьми (ADR 0165),
   * `'none'` — пусто. Без поля — полоска, у служебной — пусто.
   */
  skeletonCell?: SkeletonCellKind
}

export interface CommonHeaderAPI {
  getIsFirstHeader: () => boolean
  getIsLastHeader: () => boolean
  getIsFullHeightHeader: () => boolean
}

export interface CommonRowAPI {
  getIsFirstRow: () => boolean
  getIsLastRow: () => boolean
  getIsLastSubRow: () => boolean
}

export interface CommonHeaderGroupAPI {
  getIsFirstGroup: () => boolean
  getIsLastGroup: () => boolean
}

// --- Declaration merging в реестр v9 -----------------------------------------
// Ключ карты (`commonFeature`) = ключ фичи в `tableFeatures({ commonFeature })`.
// Сигнатуры карт (имена/ограничения/вариантность `in out`) обязаны совпадать с
// оригиналом v9 — иначе declaration merging не склеится.
/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9 (см. выше), иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    commonFeature: TableFeature
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    commonFeature: CommonOptions
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    commonFeature: CommonTableAPI<TFeatures, TData>
  }
  interface Column_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    commonFeature: CommonColumnAPI
  }
  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    in out TValue,
  > {
    commonFeature: CommonColumnDef<TData>
  }
  interface Header_FeatureMap {
    commonFeature: CommonHeaderAPI
  }
  interface Row_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    commonFeature: CommonRowAPI
  }
  // Для HeaderGroup feature-карты нет — прямой merge базового интерфейса.
  interface HeaderGroup<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > extends CommonHeaderGroupAPI {}
}
/* eslint-enable @typescript-eslint/no-unused-vars */
