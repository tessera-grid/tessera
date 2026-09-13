/**
 * Фаза A (типовой фундамент) — тип-контракт `commonFeature`: v9-порт always-on
 * `commonPlugin` ([src/lib/core/commonPlugin.ts]).
 *
 * Здесь ТОЛЬКО типы (declaration merging в feature-карты v9 + интерфейсы API).
 * Рантайм-реализация — фаза C (`commonFeature.ts`). Value-типы контракта Tessera
 * (`hooks`/`slots`/`slotActions`/`actionMenu`) на этом этапе минимальны: их
 * машинерия (`createSlots`/`headerActions`) сейчас связана с v8, поэтому детальный
 * порт откладывается — см. TODO(фаза C).
 *
 * Почему через `*_FeatureMap`, а не прямым расширением `Table`/`Column` (как в v8
 * `src/table.d.ts`): в v9 API фичи объявляются в её карте под ключом фичи, что
 * даёт feature-gated типы (метод существует в типах ровно когда фича включена).
 * Для `HeaderGroup` карты нет — используем прямой merge интерфейса (эскейп).
 */
import type {
  ColumnSizingState,
  OnChangeFn,
  RowData,
  TableFeature,
  TableFeatures,
  Updater,
} from '@tanstack/table-v9'

import type { RenderSlots } from './createSlots'
import type { SlotActionMenu, SlotActions } from './headerActions'

// --- Payload-типы контракта --------------------------------------------------
/** Бизнес-контракт хуков (бывш. глобальный дженерик THooks). */
export type CommonHooks = Record<string, unknown>
/** Слоты рендера (порт фазы C). Псевдоним сохранён для стабильности импортов. */
export type RenderSlotsV9 = RenderSlots
/** Действия слотов (порт фазы C). */
export type SlotActionsV9 = SlotActions
/** Карта конфигов схлопывания по слотам (порт фазы C). */
export type SlotActionMenuV9 = SlotActionMenu

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

// --- Опции фичи (бывш. кастомные поля TableOptionsResolved + THooks) ----------
export interface CommonOptions {
  hooks?: CommonHooks
  slots?: RenderSlotsV9
  slotActions?: SlotActionsV9
  actionMenu?: SlotActionMenuV9
  logLevel?: LogLevel
  enableSkeleton?: boolean
  enableLoading?: boolean
  enableFooter?: boolean
  /** Writer авто-слайса размеров (generic-механизм ADR 0010). */
  onColumnAutoSizingChange?: OnChangeFn<ColumnSizingState>
}

// --- Публичные API по объектам таблицы (бывш. методы из commonPlugin) ---------
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
declare module '@tanstack/table-v9' {
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
