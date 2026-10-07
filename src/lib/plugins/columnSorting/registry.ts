/**
 * Запись плагина columnSorting на `definePlugin`. Поведение даёт
 * `rowSortingFeature` + `sortedRowModel`; функции сортировки регистрируются явно
 * (`sortFns`, tree-shakeable) — здесь стандартный набор.
 */
import {
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_alphanumericCaseSensitive,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  sortFn_textCaseSensitive,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { narrowSorting } from './narrowSorting'
import { optionLabelSortFeature } from './optionLabelSort'
import { createTesseraSortedRowModel } from './sortedRowModel'
import { neverInert } from '../../core/pluginDiagnostics'
import { sortKeyboardAction } from './keyboardActions'
import { sortHeaderAction } from './sortHeaderAction'
import type { ColumnSortingHooks } from './types'

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
  /** Бизнес-колбэк сортировки (аргумент фабрики); читается живо. */
  onToggleColumnSort?: ColumnSortingHooks['onToggleColumnSort']
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

export const columnSorting = definePlugin<ColumnSortingOptions>()({
  id: 'columnSorting',
  // Режим данных — договор с потребителем на время жизни таблицы (ADR 0039).
  lifetime: ['server'],
  diagnose: neverInert,
  features: {
    rowSortingFeature,
    optionLabelSortFeature,
    sortedRowModel: createTesseraSortedRowModel(),
    sortFns,
  },
  hooks: o => ({ onToggleColumnSort: o.onToggleColumnSort }),
  // Единый дескриптор: инлайн — циклящая кнопка с бейджем приоритета;
  // в кебаб-меню — пункты asc/desc/сброс. Ядро решает подачу.
  slotActions: [sortHeaderAction],
  keyboardActions: [sortKeyboardAction],
  narrow: o => {
    if (o.enabled === false) {
      return undefined
    }
    const multi = resolveMultiSort(o.multiSort)
    const limit = multi.enabled ? multi.opts.max : 1
    return limit === undefined ? undefined : { sorting: narrowSorting(limit) }
  },
  options: o => {
    const multi = resolveMultiSort(o.multiSort)
    const isMultiSortEvent = resolveMultiSortEvent(multi.opts.event)
    return {
      enableSorting: o.enabled !== false,
      enableSortingRemoval: o.removal ?? true,
      manualSorting: o.server ?? false,
      sortDescFirst: true,
      enableMultiSort: multi.enabled,
      ...(multi.opts.max !== undefined
        ? { maxMultiSortColCount: multi.opts.max }
        : {}),
      ...(isMultiSortEvent ? { isMultiSortEvent } : {}),
    }
  },
})
