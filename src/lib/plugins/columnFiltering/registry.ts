/**
 * Запись плагина columnFiltering на `definePlugin` (ADR 0045, ADR 0120): интерфейс фильтров
 * колонок — кнопка фильтра в заголовке с панелью, сводка в тулбаре, счётчик «показано N из
 * M» и колбэк пользователя. Модель — `columnFilteringModel`, плагин её включает и передаёт
 * ей режим данных, пояс дат и срез.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import type { DayPickerLocale } from '@daypicker/react'

import { definePlugin } from '../../core/definePlugin'
import { readPluginHooks } from '../../core/definePlugin'
import type { FilterChangeHook } from '../../shared/filtering/filtering'
import { dataModeOf } from '../../core/dataMode'
import {
  type PluginInertReason,
  serverRowModelReason,
} from '../../core/pluginDiagnostics'
import {
  columnFilteringModel,
  columnFilteringModelFeatures,
  type ColumnFilteringModelOptions,
} from '../columnFilteringModel/registry'
import { DEFAULT_FILTER_DEBOUNCE_MS } from '../columnFilteringModel/conditions'
import { filterHeaderAction } from './filterHeaderAction'
import { FilterSummaryButton } from './FilterSummaryButton'
import { filteredRowsCountSlot } from '../../shared/filtering/FilteredRowsCount'

export interface ColumnFilteringOptions extends Omit<
  ColumnFilteringModelOptions,
  'enabled'
> {
  /** `false` — плагин отключён: фильтры колонок не применяются. */
  enabled?: boolean
  /** Задержка применения ввода в панели фильтра, мс (по умолчанию 200). */
  debounceMs?: number
  /** «Показано N из M» в нижней панели при активном фильтре (по умолчанию нет). */
  filteredCount?: boolean
  /**
   * Бизнес-колбэк: пользователь изменил фильтры колонок (после дебаунса). Фильтры на
   * сервере (`dataMode`, ADR 0169) — промис запроса данных: грид ждёт, отказ отмечает
   * фильтр (ADR 0116).
   */
  onFilterChange?: FilterChangeHook
  /** Фильтры или поиск на сервере: строк после фильтрации — для «показано N из M». */
  filteredRowCount?: number
  /** Фильтры или поиск на сервере: всех строк — для «показано N из M». */
  totalRowCount?: number
  /** Локаль календаря: месяцы, дни недели, первый день недели (по умолчанию `en-US`). */
  dateLocale?: DayPickerLocale
}

/**
 * Фильтры на сервере без колбэка — их некуда отправить (FL31). Серверная модель строк
 * отправляет их сама (ADR 0138).
 */
const columnFilteringInertReason = (
  table: unknown,
): PluginInertReason | undefined =>
  dataModeOf(table, 'filtering') === 'server' &&
  !serverRowModelReason(table) &&
  !readPluginHooks<{ onFilterChange?: unknown }>(
    table as { getHooks: () => unknown },
    'columnFiltering',
  ).onFilterChange
    ? 'noOnFilterChange'
    : undefined

export const columnFiltering = definePlugin<ColumnFilteringOptions>()({
  id: 'columnFiltering',
  diagnose: columnFilteringInertReason,
  model: {
    plugin: columnFilteringModel,
    keys: [
      'timeZone',
      'columnFilters',
      'onColumnFiltersChange',
      'initialColumnFilters',
    ],
  },
  features: columnFilteringModelFeatures,
  hooks: o => ({ onFilterChange: o.onFilterChange }),
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
    columnFilteringDebounceMs: o.debounceMs ?? DEFAULT_FILTER_DEBOUNCE_MS,
    columnFilteringDateLocale: o.dateLocale,
    filteringRowCounts: {
      filtered: o.filteredRowCount,
      total: o.totalRowCount,
    },
  }),
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    columnFilteringPlugin: {
      columnFilteringDateLocale?: ColumnFilteringOptions['dateLocale']
      columnFilteringDebounceMs?: number
      /** Числа «показано N из M» от приложения в серверном режиме. */
      filteringRowCounts?: { filtered?: number; total?: number }
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
