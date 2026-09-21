/**
 * Запись плагина columnSorting (ADR 0012). Поведение даёт `rowSortingFeature` +
 * слот `sortedRowModel`; функции сортировки регистрируются явно (`sortFns`,
 * tree-shakeable) — здесь стандартный набор.
 */
import {
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_alphanumericCaseSensitive,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  sortFn_textCaseSensitive,
} from '@tanstack/react-table'

import type { TesseraFeatureEntry } from '../../core/features'
import { sortHeaderAction } from './sortHeaderAction'
import type { ColumnSortingPluginParams } from './types'

/** Тонкая настройка мультисортировки. */
export interface ColumnMultiSortOptions {
  /** Максимум одновременно сортируемых столбцов (по умолчанию без лимита). */
  max?: number
  /**
   * Жест добавления столбца к сортировке. `'shift'` (по умолчанию) — штатный
   * Shift+клик; своя функция — произвольный предикат (напр. тач `() => true`).
   */
  event?: 'shift' | ((event: unknown) => boolean)
}

export interface ColumnSortingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить снятие сортировки третьим кликом (по умолчанию true). */
  removal?: boolean
  /** Серверная сортировка — v9 `manualSorting` (по умолчанию false). */
  server?: boolean
  /** Мультисортировка: `true`/`undefined` — Shift+клик; `false` — выкл; объект — тонко. */
  multiSort?: boolean | ColumnMultiSortOptions
  /** Бизнес-колбэк сортировки (аргумент фабрики, ADR 0027); читается живо. */
  onToggleColumnSort?: ColumnSortingPluginParams['onToggleColumnSort']
}

/** Стандартный набор функций сортировки. */
const sortFns = {
  alphanumeric: sortFn_alphanumeric,
  alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive,
  text: sortFn_text,
  textCaseSensitive: sortFn_textCaseSensitive,
  datetime: sortFn_datetime,
  basic: sortFn_basic,
}

const resolveMultiSort = (
  multiSort: ColumnSortingOptions['multiSort'],
): { enabled: boolean; opts: ColumnMultiSortOptions } =>
  multiSort === false
    ? { enabled: false, opts: {} }
    : { enabled: true, opts: typeof multiSort === 'object' ? multiSort : {} }

const resolveMultiSortEvent = (
  event: ColumnMultiSortOptions['event'],
): ((event: unknown) => boolean) | undefined =>
  typeof event === 'function' ? event : undefined

export const columnSorting = (opts: ColumnSortingOptions = {}) => {
  const multi = resolveMultiSort(opts.multiSort)
  const isMultiSortEvent = resolveMultiSortEvent(multi.opts.event)

  return {
    id: 'columnSorting',
    enabled: opts.enabled,
    slot: {
      rowSortingFeature,
      sortedRowModel: createSortedRowModel(),
      sortFns,
    },
    hooks: {
      columnSorting: opts.onToggleColumnSort
        ? { onToggleColumnSort: opts.onToggleColumnSort }
        : {},
    },
    // Единый дескриптор (ADR 0012): инлайн — циклящая кнопка с бейджем приоритета;
    // в кебаб-меню — пункты asc/desc/сброс. Ядро решает подачу.
    slotActions: [sortHeaderAction],
    options: {
      enableSorting: opts.enabled !== false,
      enableSortingRemoval: opts.removal ?? true,
      manualSorting: opts.server ?? false,
      sortDescFirst: true,
      enableMultiSort: multi.enabled,
      ...(multi.opts.max !== undefined
        ? { maxMultiSortColCount: multi.opts.max }
        : {}),
      ...(isMultiSortEvent ? { isMultiSortEvent } : {}),
    },
  } satisfies TesseraFeatureEntry<{
    rowSortingFeature: typeof rowSortingFeature
    sortedRowModel: ReturnType<typeof createSortedRowModel>
    sortFns: typeof sortFns
  }>
}
