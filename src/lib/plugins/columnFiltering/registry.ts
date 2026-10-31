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
import type { PluginInertReason } from '../../core/pluginDiagnostics'
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
   * Бизнес-колбэк: пользователь изменил фильтры колонок (после дебаунса). В серверном
   * режиме промис — запрос данных: грид ждёт, отказ отмечает фильтр (ADR 0116).
   */
  onFilterChange?: FilterChangeHook
  /** Серверный режим: строк после фильтрации — для «показано N из M». */
  filteredRowCount?: number
  /** Серверный режим: всех строк — для «показано N из M». */
  totalRowCount?: number
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

export const columnFiltering = definePlugin<ColumnFilteringOptions>()({
  id: 'columnFiltering',
  diagnose: columnFilteringInertReason,
  model: {
    plugin: columnFilteringModel,
    keys: [
      'server',
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
    ...(o.server
      ? {
          filteringRowCounts: {
            filtered: o.filteredRowCount,
            total: o.totalRowCount,
          },
        }
      : {}),
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
