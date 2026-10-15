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
import type { SkeletonCellKind } from './skeletonOptions'
import type {
  ColumnSizingState,
  OnChangeFn,
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
export interface CommonOptions {
  hooks?: CommonHooks
  slots?: RenderSlotsV9
  slotActions?: SlotActionsV9
  contextMenuActions?: ContextMenuAction[]
  keyboardActions?: KeyboardAction[]
  pluginDiagnostics?: PluginDiagnosticSource[]
  actionMenu?: SlotActionMenuV9
  logLevel?: LogLevel
  /**
   * Загрузка данных сейчас (ADR 0106): `'initial'` — скелет первой загрузки (ADR 0060),
   * `'refresh'` — свечение обновления (ADR 0094), `false` — нет.
   */
  loading?: 'initial' | 'refresh' | false
  enableFooter?: boolean
  /** Положение футера: у низа области или за последней строкой (ADR 0118). */
  footerPosition?: FooterPosition
  /** Верхний тулбар: без флага — по наличию `toolbarSlot` (ADR 0046). */
  enableToolbar?: boolean
  /** Нижняя панель: без флага — по наличию `statusBarSlot` (ADR 0046). */
  enableStatusBar?: boolean
  /** `false` — ядро не объявляет сортировку/выбор/копирование/загрузку. */
  enableAnnouncements?: boolean
  /** `false` — без тултипа у обрезанного текста ячеек (ADR 0075). */
  enableOverflowTooltip?: boolean
  /** `false` — без движения строк при смене модели (ADR 0107). */
  enableRowAnimation?: boolean
  /** `false` — без движения колонок при смене порядка (ADR 0115). */
  enableColumnAnimation?: boolean
  /** Высота строк тела и шапки, px (ADR 0077). */
  rowHeight?: number
  headerHeight?: number
  skeletonOptions?: SkeletonOptions
  /** Задержка и минимум показа обновления (ADR 0094). */
  refreshOptions?: RefreshOptions
  /** Отказ загрузки данных и повтор (ADR 0096). */
  loadError?: unknown
  onRetry?: () => unknown
  /**
   * Строк данных на сервере для `aria-rowcount`; `-1` — итог неизвестен,
   * `undefined` — строк столько, сколько в `data` (ADR 0081).
   */
  getTotalRowCount?: (table: unknown) => number | undefined
  /** Тело ждёт данных плагина: `aria-busy` таблицы (ADR 0081). */
  getBodyBusy?: (state: Record<string, unknown>) => boolean
  /** В `data` загружена только часть строк сервера (лента, ADR 0081). */
  partialData?: boolean
  /** Writer авто-слайса размеров (generic-механизм). */
  onColumnAutoSizingChange?: OnChangeFn<ColumnSizingState>
}

// --- Публичные API по объектам таблицы ---------------------------------------
export interface CommonTableAPI {
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
}

export interface CommonColumnAPI {
  getIsActionsColumn: () => boolean
  getIsRowActionsColumn: () => boolean
}

/** Кастомные поля columnDef Tessera; `options` / `getOptionLabel` — ADR 0048. */
export interface CommonColumnDef extends ColumnOptionsDef {
  /** Служебная колонка: ключ `localization` для скрытой подписи её заголовка. */
  serviceLabel?: 'expandColumn' | 'reorderColumn' | 'rowActionsColumn'
  /**
   * Ячейка колонки в скелетах (ADR 0060, SL18): `'bar'` — полоска, `'control'` —
   * квадрат контрола, `'none'` — пусто. Без поля — полоска, у служебной — пусто.
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
    commonFeature: CommonTableAPI
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
    commonFeature: CommonColumnDef
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
