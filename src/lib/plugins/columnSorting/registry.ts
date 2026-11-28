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
import { sortTransform } from './transform'
import { transformSection } from '../../shared/transformSection'
import type { ColumnSortingHooks } from './types'
import { columnSortingLabels } from './labels'

/** Multi-sort fine-tuning. */
export interface ColumnMultiSortOptions {
  /** Maximum number of columns sorted at once (no limit by default). */
  max?: number
  /**
   * Gesture that adds a column to the sort. `'shift'` (default) is the standard Shift+click; a
   * custom function is any predicate (for example, touch `() => true`).
   */
  event?: 'shift' | ((event: unknown) => boolean)
}

export interface ColumnSortingOptions extends Omit<
  ColumnSortingModelOptions,
  'enabled' | 'multiSort'
> {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Allow removing the sort with a third click (true by default). */
  removal?: boolean
  /**
   * In server mode, a rejection of the `onToggleColumnSort` promise reverts the sort (true by
   * default); `false` — the new sort stays (ADR 0116).
   */
  revertOnReject?: boolean
  /** Multi-sort: `true`/`undefined` — Shift+click; `false` — off; an object — fine-tuned. */
  multiSort?: boolean | ColumnMultiSortOptions
  /** Sorting business callback (a factory argument); read live. */
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

/** Раздел «Сортировка» «Настроек вида» (ADR 0215, §1): уровни по приоритету. */
const sortingSection = transformSection({
  id: 'sorting',
  order: 20,
  plugin: 'columnSorting',
  icon: 'sort',
  transform: sortTransform,
  slice: 'sorting',
  labels: labels => {
    const own = columnSortingLabels(labels)
    return {
      title: own.sorting,
      remove: own.removeSort,
      reset: own.resetSorting,
    }
  },
})

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
  // Сортировка колонки — факт ядра: её видят меню «Колонки» и «Настройки вида» (ADR 0204, §2; ADR 0215).
  columnTransforms: [sortTransform],
  viewSettingsSections: [sortingSection],
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
