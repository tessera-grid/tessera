/**
 * Запись плагина columnSorting на `definePlugin`: интерфейс сортировки (ADR 0120) —
 * кнопка в заголовке, клавиша, жест мультисортировки и колбэк пользователя. Модель —
 * `columnSortingModel`, плагин её включает и передаёт ей режим данных и срез.
 */
import { definePlugin } from '../../core/definePlugin'
import {
  columnSortingModel,
  type ColumnSortingModelOptions,
  sortingModelFeatures,
} from '../columnSortingModel/registry'
import { neverInert } from '../../core/pluginDiagnostics'
import { declareRevertOnReject } from '../../core/serverActions'
import { sortKeyboardAction } from './keyboardActions'
import { sortHeaderAction } from './sortHeaderAction'
import type { ColumnSortingHooks } from './types'
import { columnSortingLabels } from './labels'

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

export interface ColumnSortingOptions extends Omit<
  ColumnSortingModelOptions,
  'enabled' | 'multiSort'
> {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить снятие сортировки третьим кликом (по умолчанию true). */
  removal?: boolean
  /**
   * Отказ промиса `onToggleColumnSort` в серверном режиме откатывает сортировку (по
   * умолчанию true); `false` — сортировка остаётся новой (ADR 0116).
   */
  revertOnReject?: boolean
  /** Мультисортировка: `true`/`undefined` — Shift+клик; `false` — выкл; объект — тонко. */
  multiSort?: boolean | ColumnMultiSortOptions
  /** Бизнес-колбэк сортировки (аргумент фабрики); читается живо. */
  onToggleColumnSort?: ColumnSortingHooks['onToggleColumnSort']
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
  labels: [columnSortingLabels],
  actions: {
    sortAscending: labels => columnSortingLabels(labels).sortAscending,
    sortDescending: labels => columnSortingLabels(labels).sortDescending,
    clearSort: labels => columnSortingLabels(labels).clearSort,
    'columnSorting.toggle': labels => columnSortingLabels(labels).actionSort,
  },
  diagnose: neverInert,
  model: {
    plugin: columnSortingModel,
    keys: ['multiSort', 'sorting', 'onSortingChange', 'initialSorting'],
  },
  features: sortingModelFeatures,
  hooks: o => ({ onToggleColumnSort: o.onToggleColumnSort }),
  // Единый дескриптор: инлайн — циклящая кнопка с бейджем приоритета;
  // в кебаб-меню — пункты asc/desc/сброс. Ядро решает подачу.
  slotActions: [sortHeaderAction],
  setup: o => table =>
    declareRevertOnReject(table, 'sorting', o.revertOnReject !== false),
  keyboardActions: [sortKeyboardAction],
  options: o => {
    const multi = resolveMultiSort(o.multiSort)
    const isMultiSortEvent = resolveMultiSortEvent(multi.opts.event)
    return {
      enableSortingRemoval: o.removal ?? true,
      sortDescFirst: true,
      enableMultiSort: multi.enabled,
      ...(multi.opts.max !== undefined
        ? { maxMultiSortColCount: multi.opts.max }
        : {}),
      ...(isMultiSortEvent ? { isMultiSortEvent } : {}),
    }
  },
})
