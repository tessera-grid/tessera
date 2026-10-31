/**
 * Тип-контракт `commonFeature` (always-on). Здесь ТОЛЬКО типы (declaration merging
 * в feature-карты v9 + интерфейсы API); рантайм-реализация — `commonFeature.ts`.
 *
 * Почему через `*_FeatureMap`, а не прямым расширением `Table`/`Column`: в v9 API
 * фичи объявляются в её карте под ключом фичи, что даёт feature-gated типы (метод
 * существует в типах ровно когда фича включена). Для `HeaderGroup` карты нет —
 * используем прямой merge интерфейса (эскейп).
 */
import type { ColumnOptionsDef } from './columnOptions'
import type { ServiceColumnInfo } from './createColumns'
import type { ColumnDataType } from './columnDataType'
import type { DataMode } from './dataMode'
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
import type {
  PluginDiagnostic,
  PluginDiagnosticSource,
} from './pluginDiagnostics'
import type { SkeletonOptions } from './skeletonOptions'
import type { FooterPosition } from './footer'
import type { StubEntry } from './stubs'
import type { FoldedWrappers } from './pluginWrappers'
import type { RefreshOptions } from './loadingDisplay'

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
  /** Нижняя панель: без флага — по наличию её слотов, `true` — всегда, `false` — никогда (ADR 0046). */
  enableStatusBar?: boolean
  /** `false` — ядро не объявляет изменения скринридеру (ADR 0032, W9). */
  enableAnnouncements?: boolean
  /** `false` — без тултипа у обрезанного текста ячеек (ADR 0075). */
  enableOverflowTooltip?: boolean
  /** `false` — смены модели строк мгновенны, без движения (ADR 0107). */
  enableRowAnimation?: boolean
  /** `false` — смены порядка колонок мгновенны, без движения (ADR 0115). */
  enableColumnAnimation?: boolean
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
  /** Высота строк тела, футера и скелета, px; по умолчанию 50, не ниже 40 (ADR 0077). */
  rowHeight?: number
  /** Высота каждой строки шапки, px; по умолчанию — как `rowHeight`, не ниже 36. */
  headerHeight?: number
}

/** Опции `commonFeature`: опции ядра и каналы сборки и плагинов (ADR 0164). */
export interface CommonOptions extends CoreOptions {
  hooks?: CommonHooks
  slots?: RenderSlotsV9
  slotActions?: SlotActionsV9
  contextMenuActions?: ContextMenuAction[]
  /** Заглушки пустой таблицы плагинов (ADR 0123). */
  stubEntries?: StubEntry[]
  keyboardActions?: KeyboardAction[]
  pluginDiagnostics?: PluginDiagnosticSource[]
  actionMenu?: SlotActionMenuV9
  logLevel?: LogLevel
  /** Пересчитать сужение срезов: плагин сменил то, что сужение читает (ADR 0160). */
  refreshNarrowing?: () => void
  /** Номер перерисовки ячеек: растёт при новой функции-аргументе плагина (ADR 0039). */
  pluginRenderVersion?: number
  /** Обёртки и декораторы тела и шапки от плагинов (ADR 0168, §2). */
  pluginWrappers?: FoldedWrappers
  /** Колбэки изменений локальных срезов плагинов по ключу среза (DP17). */
  pluginStateListeners?: Record<string, (next: unknown) => void>
  /**
   * Строк данных на сервере для `aria-rowcount`; `-1` — итог неизвестен,
   * `undefined` — строк столько, сколько в `data` (ADR 0081).
   */
  getTotalRowCount?: (table: unknown) => number | undefined
  /** Свой источник строк тела (серверная модель строк, ADR 0138); один объект на таблицу. */
  getRowSource?: (table: unknown) => RowSource
  /** Тело ждёт данных плагина: `aria-busy` таблицы (ADR 0081). */
  getBodyBusy?: (state: object) => boolean
  /** В `data` загружена только часть строк сервера (лента, ADR 0081). */
  partialData?: boolean
  /** Строки показаны страницами модели пагинации (ADR 0169, §6). */
  pagedRows?: boolean
  /** Новая `data` только дописывает строки в конец прежней (лента, ADR 0145). */
  appendOnlyData?: boolean
  /** Writer авто-слайса размеров (generic-механизм). */
  onColumnAutoSizingChange?: OnChangeFn<ColumnSizingState>
}

// --- Публичные API по объектам таблицы ---------------------------------------
export interface CommonTableAPI<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> {
  /** Строки тела по индексу и по id (ADR 0138, §2). */
  getRowSource: () => RowSource<Row<TFeatures, TData>>
  getHooks: () => CommonHooks | undefined
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
}

/** Кастомные поля columnDef Tessera; `options` / `getOptionLabel` — ADR 0048. */
export interface CommonColumnDef<TData = any> extends ColumnOptionsDef {
  /** Тип значения колонки: разбор ввода правки (ADR 0139). Без поля — по значению ячейки. */
  dataType?: ColumnDataType
  /** Свой разбор текста редактора, главнее `dataType` (ADR 0139). */
  parseValue?: (text: string, row: TData) => unknown
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
