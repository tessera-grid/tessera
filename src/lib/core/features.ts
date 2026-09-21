/**
 * Presence-based сборка набора фич v9 (ADR 0010). Свёртка: always-on
 * `commonFeature` + слоты активных записей → один объект → `tableFeatures()`.
 *
 * Компромисс по типам: полностью динамический массив теряет статическую валидацию
 * слотов v9. Здесь тип итога — пересечение слотов записей (+ commonFeature);
 * рантайм-валидацию делает `tableFeatures()`. Типобезопасный путь для
 * фиксированного набора — литерал (см. использование в тестах).
 */
import {
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  tableFeatures,
} from '@tanstack/react-table'

import { commonFeature } from './commonFeature'
import type { ServiceColumn } from './createColumns'
import {
  createEmptyRenderSlots,
  registerSlotInto,
  type PluginSlot,
  type RenderSlots,
} from './createSlots'
import {
  createEmptySlotActions,
  registerSlotActionInto,
  type ActionMenuDeclaration,
  type SlotAction,
  type SlotActionMenu,
  type SlotActions,
} from './headerActions'

/**
 * Запись фичи Tessera (v9-аналог RegistryEntry, ADR 0010): фрагмент карты фич +
 * табличные опции + декларативные слоты/действия/меню. `features` идёт в
 * `tableFeatures()`; остальное сворачивается в опции таблицы (`foldEntries`).
 */
export interface TesseraFeatureEntry<TFeatures extends object = object> {
  id: string
  /**
   * Фрагмент для `tableFeatures({...})`, напр. `{ rowSortingFeature, sortedRowModel,
   * sortFns }`. Опционален: запись может нести только декларативные действия/меню
   * (slotActions/actionMenu) без собственной фичи.
   */
  features?: TFeatures
  /** Наличие = включено (как `enabled` в текущем RegistryEntry). */
  enabled?: boolean
  /** Табличные опции фичи (напр. `{ enableSorting: true }`) — вливаются в опции useTable. */
  options?: Record<string, unknown>
  /**
   * Живой слайс бизнес-хуков плагина (колбэки/флаги), читается через
   * `table.getHooks()`. В отличие от `options`/`slots`, НЕ мемоизируется по сигнатуре
   * набора — сворачивается каждый рендер (`foldHooks`), чтобы колбэки оставались
   * актуальными на момент вызова. Ключ верхнего уровня — scope плагина.
   */
  hooks?: Record<string, unknown>
  /** Декларативные слоты плагина. */
  slots?: PluginSlot[]
  /** Декларативные действия слота (кебаб/инлайн). */
  slotActions?: SlotAction[]
  /** Декларация плагина-меню: на какие слоты распространить кебаб. */
  actionMenu?: ActionMenuDeclaration
  /** Сервисная колонка плагина (напр. колонка раскрытия/выбора). */
  column?: ServiceColumn
  /**
   * Императивный сетап ПОСЛЕ создания таблицы (generic-escape, ADR 0010): побочный
   * эффект, невыразимый через фичу/опции (напр. rowActions пишет авто-слайс ширины
   * через table.setColumnAutoSizing). Ядро выполняет setups активных записей в
   * едином useEffect; может вернуть cleanup.
   */
  setup?: (table: unknown) => void | (() => void)
}

/** Свёрнутая из записей конфигурация — уходит в опции таблицы / сборку колонок. */
export interface FoldedEntryConfig {
  options: Record<string, unknown>
  slots: RenderSlots
  slotActions: SlotActions
  actionMenu: SlotActionMenu
  serviceColumns: ServiceColumn[]
  setups: NonNullable<TesseraFeatureEntry['setup']>[]
}

const isActive = (entry: TesseraFeatureEntry) => entry.enabled !== false

/**
 * Чистая свёртка активных записей в опции таблицы. Порядок фолда = порядок
 * записей, как в императивной регистрации. Используется и `useCreateTable`, и
 * headless-тестами.
 */
export const foldEntries = (
  entries: readonly TesseraFeatureEntry[],
): FoldedEntryConfig => {
  const options: Record<string, unknown> = {}
  const slots = createEmptyRenderSlots()
  const slotActions = createEmptySlotActions()
  const actionMenu: SlotActionMenu = {}
  const serviceColumns: ServiceColumn[] = []
  const setups: NonNullable<TesseraFeatureEntry['setup']>[] = []

  for (const entry of entries) {
    // Опции берём от ВСЕХ присутствующих записей (в т.ч. enabled:false) — фабрика
    // отключённого плагина эмитит enable*:false, гася свою (всегда-присутствующую в
    // наборе) фичу. Слоты/колонки/действия/setup — только у активных (реактивный UI).
    Object.assign(options, entry.options)

    if (!isActive(entry)) {
      continue
    }

    entry.slots?.forEach(slot => registerSlotInto(slots, slot))
    entry.slotActions?.forEach(action =>
      registerSlotActionInto(slotActions, action),
    )

    if (entry.column) {
      serviceColumns.push(entry.column)
    }

    if (entry.setup) {
      setups.push(entry.setup)
    }

    if (entry.actionMenu) {
      const { slots: menuSlots, mode, threshold } = entry.actionMenu
      menuSlots.forEach(slot => {
        actionMenu[slot] = { mode, threshold }
      })
    }
  }

  return { options, slots, slotActions, actionMenu, serviceColumns, setups }
}

/**
 * Живая свёртка hook-слайсов активных записей. В отличие от `foldEntries`,
 * вызывается КАЖДЫЙ рендер (не мемоизируется по сигнатуре набора): бизнес-колбэки
 * должны быть актуальны на момент вызова через `table.getHooks()`. No-op дефолты и
 * дедуп по scope подкладывает `resolveHooks`.
 */
export const foldHooks = (
  entries: readonly TesseraFeatureEntry[],
): Record<string, unknown> => {
  const hooks: Record<string, unknown> = {}
  for (const entry of entries) {
    if (isActive(entry) && entry.hooks) {
      Object.assign(hooks, entry.hooks)
    }
  }
  return hooks
}

type UnionToIntersection<U> = (
  U extends unknown ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never

type MergeFeatures<T extends readonly TesseraFeatureEntry[]> =
  UnionToIntersection<T[number]['features']>

/**
 * Тип набора фич: always-on `commonFeature` + `columnOrderingFeature` (порядок/
 * индексы колонок нужны гриду всегда — getIndex/getIsFirstColumn/getIsLastColumn)
 * + слоты записей.
 */
export type TesseraFeatures<T extends readonly TesseraFeatureEntry[]> = {
  commonFeature: typeof commonFeature
  columnOrderingFeature: typeof columnOrderingFeature
  columnVisibilityFeature: typeof columnVisibilityFeature
  columnPinningFeature: typeof columnPinningFeature
  columnSizingFeature: typeof columnSizingFeature
  columnGroupingFeature: typeof columnGroupingFeature
} & MergeFeatures<T>

/**
 * Собрать набор фич из записей. Отсеивает `enabled: false`, вклеивает always-on
 * `commonFeature` + `columnOrderingFeature`, сливает слоты и прогоняет через
 * `tableFeatures()`.
 */
export const buildTesseraFeatures = <
  const T extends readonly TesseraFeatureEntry[],
>(
  entries: T,
): TesseraFeatures<T> => {
  const merged: Record<string, unknown> = {
    commonFeature,
    columnOrderingFeature,
    columnVisibilityFeature,
    columnPinningFeature,
    columnSizingFeature,
    columnGroupingFeature,
  }

  // Фичи ВСЕХ присутствующих записей (в т.ч. enabled:false): v9 фиксирует набор фич
  // на маунте useTable, поэтому рантайм-включение плагина не добавит фичу. Держим
  // фичу всегда (как v8 keepFeatureWhenDisabled), а поведение гейтим опцией
  // (enable*:false у отключённого плагина — foldEntries эмитит её от всех записей).
  for (const entry of entries) {
    Object.assign(merged, entry.features)
  }

  return tableFeatures(merged as never) as TesseraFeatures<T>
}
