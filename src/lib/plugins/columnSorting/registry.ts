import { ColumnSortingComponent } from './ColumnSortingComponent'
import { PluginOptions, RegistryEntry } from '../types'
import { columnSortingPlugin } from './columnSortingPlugin'
import type { ColumnSortingPlugin } from './types'

/** Тонкая настройка мультисортировки (несколько столбцов одновременно). */
export interface ColumnMultiSortOptions {
  /**
   * Максимум одновременно сортируемых столбцов (по умолчанию без лимита). При
   * добавлении сверх лимита вытесняется самый старый столбец (штатный
   * `maxMultiSortColCount` TanStack).
   */
  max?: number
  /**
   * Жест добавления столбца к сортировке. `'shift'` (по умолчанию) — Shift+клик
   * (штатный `isMultiSortEvent` TanStack); своя функция — произвольный предикат
   * по событию (напр. тач-накопление `() => true`).
   */
  event?: 'shift' | ((event: unknown) => boolean)
}

export interface ColumnSortingOptions extends PluginOptions {
  /** Разрешить снятие сортировки третьим кликом (по умолчанию true). */
  removal?: boolean
  /** Серверная сортировка — TanStack manualSorting (по умолчанию false). */
  server?: boolean
  /**
   * Мультисортировка. `true`/`undefined` — включена штатным жестом Shift+клик;
   * `false` — выключена (клик всегда заменяет сортировку); объект — тонкая
   * настройка (`max` / `removal` / `event`).
   */
  multiSort?: boolean | ColumnMultiSortOptions
}

/** Свести `multiSort` к объекту опций и флагу включения. */
const resolveMultiSort = (
  multiSort: ColumnSortingOptions['multiSort'],
): { enabled: boolean; opts: ColumnMultiSortOptions } => {
  if (multiSort === false) {
    return { enabled: false, opts: {} }
  }

  return {
    enabled: true,
    opts: typeof multiSort === 'object' ? multiSort : {},
  }
}

/** Предикат мультисорт-жеста: `undefined`/`'shift'` → штатный дефолт TanStack. */
const resolveMultiSortEvent = (
  event: ColumnMultiSortOptions['event'],
): ((event: unknown) => boolean) | undefined =>
  typeof event === 'function' ? event : undefined

export const columnSorting = (
  opts: ColumnSortingOptions = {},
): RegistryEntry<ColumnSortingPlugin> => {
  const multi = resolveMultiSort(opts.multiSort)
  const isMultiSortEvent = resolveMultiSortEvent(multi.opts.event)

  return {
    id: 'columnSorting',
    enabled: opts.enabled,
    feature: columnSortingPlugin,
    slots: [
      {
        id: 'columnSortingPlugin',
        slot: 'rightHeaderSlot',
        order: 1,
        component: ColumnSortingComponent,
      },
    ],
    options: {
      enableSorting: true,
      enableSortingRemoval: opts.removal ?? true,
      manualSorting: opts.server ?? false,
      sortDescFirst: true,
      // Фиксируем явно, чтобы `multiSort: false` гасил фичу независимо от дефолта
      // TanStack. Снятие из мультисорта делит опцию с одиночным (`removal`):
      // `enableMultiRemove` в цикле affordance TanStack 8.20 не участвует.
      enableMultiSort: multi.enabled,
      ...(multi.opts.max !== undefined
        ? { maxMultiSortColCount: multi.opts.max }
        : {}),
      ...(isMultiSortEvent ? { isMultiSortEvent } : {}),
    },
  }
}
