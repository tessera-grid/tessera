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
/** Опции ядра, которые задаёт приложение в `useCreateTable` (ADR 0164). */
export interface CoreOptions {
  /**
   * Где выполняются операции над строками (ADR 0169): `'client'`, `'server'` или по
   * операциям `sorting`, `filtering`, `search`, `pagination`, `export`; не заданная
   * операция — на клиенте. Значение берётся при монтировании.
   */
  dataMode?: DataMode
  /**
   * Строк на сервере для текущего запроса (ADR 0169, §4): после фильтров и поиска, `-1` —
   * неизвестно. Пейджер, серверная модель строк, лента, `aria-rowcount` и «показано N из M»
   * читают его через ядро (`rowCountOf`).
   */
  rowCount?: number
  /** Строк на сервере до фильтров и поиска — для «показано N из M». */
  totalRowCount?: number
  /** Язык форм слова, чисел и списков в подписях (BCP 47), по умолчанию `en-US` (ADR 0169, §5). */
  locale?: string
  /**
   * Пределы одной операции записи в ячейках (ADR 0223): больше `confirm` — вопрос, больше `max`
   * — отказ; по умолчанию 5 000 и 15 000, `false` — без пределов.
   */
  writeLimits?: WriteLimits | false
  /** Свои типы данных колонок и замена полей встроенных (ADR 0172, §1). */
  dataTypes?: DataTypeRegistry
  /**
   * Пояс дат (IANA или `'UTC'`): сутки, «сегодня», пресеты и стенное время фильтра дат и
   * выгрузки; по умолчанию — пояс браузера (ADR 0169, §5).
   */
  timeZone?: string
  /**
   * Язык календарей дат — месяцы, дни недели, первый день недели: объект `Locale`
   * `date-fns`; по умолчанию `en-US`. Его читают фильтр дат и редактор даты (ADR 0175).
   */
  dateLocale?: DayPickerLocale
  /**
   * Загрузка данных сейчас (ADR 0106): `'initial'` — скелет первой загрузки (ADR 0060),
   * `'refresh'` — свечение обновления (ADR 0094), `false` — нет.
   */
  loading?: 'initial' | 'refresh' | false
  enableFooter?: boolean
  /**
   * Положение строки футера (ADR 0118): `'pinned'` — всегда у низа области прокрутки,
   * `'inline'` — сразу за последней строкой, прокручивается вместе с телом.
   */
  footerPosition?: FooterPosition
  /** Верхний тулбар: без флага — по наличию кнопок плагинов, `true` — всегда, `false` — никогда (ADR 0046). */
  enableToolbar?: boolean
  /** Место кнопки «Настройки вида» в тулбаре; `false` — кнопки нет (ADR 0215, §2). */
  viewSettingsToolbar?: ToolbarPlacement | false
  /** Нижняя панель: без флага — по наличию её слотов, `true` — всегда, `false` — никогда (ADR 0046). */
  enableStatusBar?: boolean
  /** `false` — ядро не объявляет изменения скринридеру (ADR 0032, W9). */
  enableAnnouncements?: boolean
  /**
   * Клавиатурная навигация по ячейкам (ADR 0021, ADR 0170): роль `grid` (`treegrid`), roving
   * `tabindex` и клавиши; без флага — `role="table"`.
   */
  enableKeyboardNavigation?: boolean
  /** Активная ячейка у приложения — индексы отображения (KN31, ADR 0171, §4). */
  activeCell?: ActiveCell
  /** Активная ячейка сменилась — стрелками, кликом или Tab. */
  onActiveCellChange?: (next: ActiveCell) => void
  /** Активная ячейка при монтировании, если её не ведёт приложение (EF10). */
  initialActiveCell?: ActiveCell
  /** Черновики у приложения (ADR 0178, §1): введённое, но не применённое. */
  drafts?: readonly Draft[]
  /** Черновики сменились — изнутри грида или API таблицы. */
  onDraftsChange?: (next: readonly Draft[]) => void
  /** Черновики при монтировании, если их не ведёт приложение. */
  initialDrafts?: readonly Draft[]
  /** `false` — без тултипа у обрезанного текста ячеек (ADR 0075). */
  enableOverflowTooltip?: boolean
  /** `false` — смены модели строк мгновенны, без движения (ADR 0107). */
  enableRowAnimation?: boolean
  /** `false` — смены порядка колонок мгновенны, без движения (ADR 0115). */
  enableColumnAnimation?: boolean
  /**
   * `false` — первый рендер и смена всего окна одним проходом, без переходов React: для
   * приложения с `<ViewTransition>` над гридом (ADR 0203).
   */
  enableIncrementalRender?: boolean
  skeletonOptions?: SkeletonOptions
  /** Задержка и минимум показа обновления при `loading: 'refresh'` (ADR 0094). */
  refreshOptions?: RefreshOptions
  /**
   * Отказ загрузки данных (ADR 0096): `Error` или строка; `null` — ошибки нет. С данными —
   * красный свет под шапкой и плашка, без данных — заглушка ошибки.
   */
  loadError?: unknown
  /** Повтор загрузки из плашки и заглушки; промис держит кнопку в ожидании. */
  onRetry?: () => unknown
  /** Канал действий грида: что сделал пользователь, приложение или грид (ADR 0125). */
  onDebugAction?: OnDebugAction
  /** Новый отказ в реестре отказов (ADR 0177, §6) — например, для своего трекера ошибок. */
  onFailure?: (failure: Failure) => void
  /**
   * Следующий `data` клиентской транзакции `table.applyRowTransaction` (ADR 0194, §4):
   * приложение кладёт его в `data`. Без обработчика транзакция в клиентском режиме не
   * применяется.
   */
  onDataChange?: (data: any[], transaction: RowTransaction) => void
  /** Высота строк тела, футера и скелета, px; по умолчанию 50, не ниже 40 (ADR 0077). */
  rowHeight?: number
  /** Высота каждой строки шапки, px; по умолчанию — как `rowHeight`, не ниже 36. */
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
