/**
 * Запись плагина columnFiltering на `definePlugin` (ADR 0045): стоковые
 * `columnFilteringFeature`, общая отфильтрованная модель строк и типы фильтров колонок
 * (`filter` в описании колонки). Фильтры разных колонок объединяются через И.
 */
import type { DayPickerLocale } from '@daypicker/react'
import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { createSearchAwareFilteredRowModel } from '../../core/filteredRowModel'
import { readPluginHooks } from '../../core/definePlugin'
import type { ColumnFilterEntry } from '../../core/filtering'
import type { PluginInertReason } from '../../core/pluginDiagnostics'
import { columnFilterTypesFeature } from './columnFilterTypesFeature'
import { DEFAULT_FILTER_DEBOUNCE_MS } from './conditions'
import { filterHeaderAction } from './filterHeaderAction'
import { FilterSummaryButton } from './FilterSummaryButton'
import { filteredRowsCountSlot } from '../../grid/filtering/FilteredRowsCount'

export interface ColumnFilteringOptions {
  /** `false` — плагин отключён: фильтры колонок не применяются. */
  enabled?: boolean
  /** Задержка применения ввода в панели фильтра, мс (по умолчанию 200). */
  debounceMs?: number
  /** «Показано N из M» в нижней панели при активном фильтре (по умолчанию нет). */
  filteredCount?: boolean
  /**
   * Серверная фильтрация — v9 `manualFiltering`: грид не фильтрует, `data` — уже
   * результат. Режим данных общий с `quickSearch` (ADR 0045, §10).
   */
  server?: boolean
  /** Бизнес-колбэк: пользователь изменил фильтры колонок (после дебаунса). */
  onFilterChange?: (filters: ColumnFilterEntry[]) => void
  /** Серверный режим: строк после фильтрации — для «показано N из M». */
  filteredRowCount?: number
  /** Серверный режим: всех строк — для «показано N из M». */
  totalRowCount?: number
  /**
   * Пояс дат (IANA или `'UTC'`): сутки, «сегодня», пресеты и стенное время
   * `datetime`; по умолчанию — пояс браузера (ADR 0047, §4).
   */
  timeZone?: string
  /** Локаль календаря: месяцы, дни недели, первый день недели (по умолчанию `en-US`). */
  dateLocale?: DayPickerLocale
}

/** Серверный режим без колбэка: фильтры некуда отправить (FL31). */
const columnFilteringInertReason = (
  table: unknown,
): PluginInertReason | undefined => {
  const t = table as {
    options: { columnFilteringServer?: boolean }
    getHooks: () => unknown
  }
  return t.options.columnFilteringServer &&
    !readPluginHooks<{ onFilterChange?: unknown }>(t, 'columnFiltering')
      .onFilterChange
    ? 'noOnFilterChange'
    : undefined
}

const NO_FILTERS: never[] = []

export const columnFiltering = definePlugin<ColumnFilteringOptions>()({
  id: 'columnFiltering',
  // Режим данных — договор с потребителем на время жизни таблицы (ADR 0039).
  lifetime: ['server'],
  diagnose: columnFilteringInertReason,
  hooks: o => ({ onFilterChange: o.onFilterChange }),
  features: {
    columnFilteringFeature,
    columnFilterTypesFeature,
    filteredRowModel: createSearchAwareFilteredRowModel(),
    // Счётчики вариантов — по строкам без фильтра своей колонки (ADR 0048, §3).
    columnFacetingFeature,
    facetedRowModel: createFacetedRowModel(),
  },
  // Выключенный плагин не фильтрует: эффективный срез пуст, сохранённый не меняется
  // (ADR 0039) — включили снова, фильтры вернулись.
  narrow: o =>
    o.enabled === false ? { columnFilters: () => NO_FILTERS } : undefined,
  slotActions: [filterHeaderAction],
  // Счётчик — opt-in: у гридов с фильтрами нижняя панель не появляется сама.
  slots: o => [
    {
      id: 'filterSummaryButton',
      slot: 'toolbarSlot',
      // Рядом с поиском: оба сужают данные (ADR 0051).
      align: 'start',
      group: 'search',
      order: 1,
      component: FilterSummaryButton,
    },
    ...(o.filteredCount ? [filteredRowsCountSlot] : []),
  ],
  options: o => ({
    enableColumnFilters: o.enabled !== false,
    // В дереве родитель виден, если фильтр проходит потомок (FL22).
    filterFromLeafRows: true,
    columnFilteringDebounceMs: o.debounceMs ?? DEFAULT_FILTER_DEBOUNCE_MS,
    columnFilteringTimeZone: o.timeZone,
    columnFilteringDateLocale: o.dateLocale,
    columnFilteringServer: !!o.server,
    ...(o.server
      ? {
          manualFiltering: true,
          filteringRowCounts: {
            filtered: o.filteredRowCount,
            total: o.totalRowCount,
          },
        }
      : {}),
  }),
})
