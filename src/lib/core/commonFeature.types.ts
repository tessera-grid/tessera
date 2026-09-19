/**
 * Тип-контракт `commonFeature` (always-on). Здесь ТОЛЬКО типы (declaration merging
 * в feature-карты v9 + интерфейсы API); рантайм-реализация — `commonFeature.ts`.
 *
 * Почему через `*_FeatureMap`, а не прямым расширением `Table`/`Column`: в v9 API
 * фичи объявляются в её карте под ключом фичи, что даёт feature-gated типы (метод
 * существует в типах ровно когда фича включена). Для `HeaderGroup` карты нет —
 * используем прямой merge интерфейса (эскейп).
 */
import type {
  ColumnSizingState,
  OnChangeFn,
  RowData,
  TableFeature,
  TableFeatures,
  Updater,
} from '@tanstack/react-table'

import type { RenderSlots } from './createSlots'
import type { SlotActionMenu, SlotActions } from './headerActions'
import type { SkeletonOptions } from './skeletonOptions'

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
  actionMenu?: SlotActionMenuV9
  logLevel?: LogLevel
  enableSkeleton?: boolean
  enableLoading?: boolean
  enableFooter?: boolean
  skeletonOptions?: SkeletonOptions
  /** Writer авто-слайса размеров (generic-механизм ADR 0010). */
  onColumnAutoSizingChange?: OnChangeFn<ColumnSizingState>
}

// --- Публичные API по объектам таблицы ---------------------------------------
export interface CommonTableAPI {
  getHooks: () => CommonHooks | undefined
  getRenderSlots: () => RenderSlotsV9 | undefined
  getSlotActions: () => SlotActionsV9 | undefined
  getIsAnyColumnResizing: () => boolean
  setColumnAutoSizing: (updater: Updater<ColumnSizingState>) => void
}

export interface CommonColumnAPI {
  getIsActionsColumn: () => boolean
  getIsRowActionsColumn: () => boolean
}

/** Кастомные поля columnDef Tessera. */
export interface CommonColumnDef {
  /** Число строк вложенной шапки, которые перекрывает заголовок (grid-раскладка). */
  rowSpan?: number
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
