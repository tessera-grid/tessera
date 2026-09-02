import { TableOptionsResolved } from '@tanstack/react-table'

import { RegistryEntry } from '../pluginContract'

// Генерик-помощники для сборки опций таблицы из записей плагинов (ADR 0010).
// Ядро не знает конкретных плагинов — только общий контракт RegistryEntry.

/**
 * Базовый набор фичевых опций «всё выключено». Многие стандартные опции TanStack
 * (`enableSorting`, `enableColumnPinning`, `enableGrouping`, `enableRowSelection`)
 * по умолчанию истинны, поэтому отсутствие плагина обязано явно гасить фичу. Это
 * чистая конфигурация TanStack/наших опций — не импорт плагина. Опции, значимые
 * только при активной фиче (`sortDescFirst`, `maxExpandingDepth`, …), базой не
 * задаются — их ставит фабрика соответствующего плагина.
 */
export const FEATURE_OFF_BASELINE: Partial<TableOptionsResolved<any>> = {
  enableColumnPinning: false,
  enableColumnResizing: false,
  enableSorting: false,
  enableSortingRemoval: true,
  sortDescFirst: true,
  manualSorting: false,
  enableRowSelection: false,
  enableSubRowSelection: false,
  enableColumnDragging: false,
  enableRowDragging: false,
  enableRowExpanding: false,
  autoResetExpanded: false,
  enableGrouping: false,
  groupedColumnMode: false,
}

/** Свернуть опции всех записей в один объект опций для useReactTable. */
export const foldPluginOptions = (
  entries: RegistryEntry[],
): Partial<TableOptionsResolved<any>> =>
  entries.reduce(
    (acc, entry) => ({ ...acc, ...entry.options }),
    {} as Partial<TableOptionsResolved<any>>,
  )
