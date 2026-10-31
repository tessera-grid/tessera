/**
 * Запись плагина columnFilteringModel на `definePlugin`: модель фильтров колонок без
 * интерфейса (ADR 0045, ADR 0120). Строки отфильтрованы по срезу `columnFilters` и типам
 * `filter` колонок, фильтры разных колонок объединяются через И; кнопка фильтра, сводка и
 * колбэк пользователя — у `columnFiltering`, который включает эту модель.
 */
import {
  type ColumnFiltersState,
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  type RowData,
  type TableFeatures,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { FILTERED_STUB } from '../../shared/filtering/filtering'
import { createSearchAwareFilteredRowModel } from '../../shared/rowModels/filteredRowModel'
import { neverInert } from '../../core/pluginDiagnostics'
import { columnFilterTypesFeature } from './columnFilterTypesFeature'

export interface ColumnFilteringModelOptions {
  /** `false` — плагин отключён: фильтры колонок не применяются. */
  enabled?: boolean
  /**
   * Пояс дат (IANA или `'UTC'`): сутки, «сегодня», пресеты и стенное время
   * `datetime`; по умолчанию — пояс браузера (ADR 0047, §4).
   */
  timeZone?: string
  /** Фильтры колонок: задаёт приложение; без него срез хранит грид. */
  columnFilters?: ColumnFiltersState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onColumnFiltersChange?: (next: ColumnFiltersState) => void
  /** Начальное значение среза, которым владеет грид. */
  initialColumnFilters?: ColumnFiltersState
}

/** Фичи модели фильтров; интерфейс несёт те же — по ним выводится тип среза. */
export const columnFilteringModelFeatures = {
  columnFilteringFeature,
  columnFilterTypesFeature,
  filteredRowModel: createSearchAwareFilteredRowModel(),
  // Счётчики вариантов — по строкам без фильтра своей колонки (ADR 0048, §3).
  columnFacetingFeature,
  facetedRowModel: createFacetedRowModel(),
}

const NO_FILTERS: never[] = []

export const columnFilteringModel = definePlugin<ColumnFilteringModelOptions>()(
  {
    id: 'columnFilteringModel',
    diagnose: neverInert,
    stubs: [FILTERED_STUB],
    features: columnFilteringModelFeatures,
    slices: ['columnFilters'],
    // Выключенная модель не фильтрует: эффективный срез пуст, сохранённый не меняется
    // (ADR 0039) — включили снова, фильтры вернулись.
    narrow: o =>
      o.enabled === false
        ? {
            // Пустой срез — как есть: новая ссылка сбросила бы страницу (PG10).
            columnFilters: (value?: unknown[]) =>
              value?.length ? NO_FILTERS : value,
          }
        : undefined,
    options: o => ({
      enableColumnFilters: o.enabled !== false,
      // В дереве родитель виден, если фильтр проходит потомок (FL22).
      filterFromLeafRows: true,
      columnFilteringTimeZone: o.timeZone,
    }),
  },
)

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    columnFilteringModelPlugin: {
      columnFilteringTimeZone?: ColumnFilteringModelOptions['timeZone']
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
