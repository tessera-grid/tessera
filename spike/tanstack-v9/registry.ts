/**
 * СПАЙК v9 — presence-based композиция поверх `tableFeatures()`.
 *
 * Отвечает на открытый вопрос Q2 плана: «как собрать `tableFeatures()` из
 * динамического массива плагинов, сохранив наш DX `plugins={[...]}`».
 *
 * Вывод спайка: `tableFeatures(x)` в рантайме — это почти тождество (валидирует
 * слоты и возвращает тот же объект). Значит presence-based-слой Tessera
 * превращается из «собрать массив `_features`» в «слить фрагменты-карты активных
 * записей в ОДИН объект и прогнать через `tableFeatures()`».
 *
 * Тонкость (ТИПЫ): при ПОЛНОСТЬЮ динамическом массиве статическая валидация слотов
 * `tableFeatures()` и точный тип итогового набора теряются — `buildTableFeatures`
 * возвращает пересечение фрагментов, но не может проверить зависимости фич на
 * этапе типов. Для типобезопасного пути набор собирается литералом объекта (см.
 * `prototype.tsx`). Это и есть один из пунктов, который должен был прояснить спайк.
 */
import { tableFeatures } from '@tanstack/table-v9'

/** Запись плагина Tessera в терминах v9: id + фрагмент карты фич. */
export interface PluginEntryV9<TSlot extends object = object> {
  id: string
  /** Фрагмент для `tableFeatures({...})`: `{ rowSortingFeature, sortedRowModel, sortFns }` и т.п. */
  slot: TSlot
  /** Наличие = включено (как `enabled` в текущем RegistryEntry). */
  enabled?: boolean
}

/** Свести объединение фрагментов в пересечение (как наш UnionToIntersection). */
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never

type MergeSlots<T extends readonly PluginEntryV9[]> = UnionToIntersection<
  T[number]['slot']
>

/**
 * Презенс-билдер: отсеивает выключенные, сливает фрагменты в один объект и прогоняет
 * через `tableFeatures()`. Рантайм — как было в ядре; типы — пересечение слотов.
 */
export const buildTableFeatures = <const T extends readonly PluginEntryV9[]>(
  entries: T,
) => {
  const merged = {} as Record<string, unknown>

  for (const entry of entries) {
    if (entry.enabled === false) {
      continue
    }
    Object.assign(merged, entry.slot)
  }

  // Приведение: рантайм-валидация слотов делается tableFeatures(); статическую
  // валидацию динамический путь не даёт (задокументировано в README спайка).
  return tableFeatures(merged as never) as MergeSlots<T>
}
