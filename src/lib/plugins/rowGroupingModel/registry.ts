/**
 * Запись плагина rowGroupingModel на `definePlugin`: модель группировки без интерфейса
 * (ADR 0016, ADR 0120). Строки сгруппированы по срезу `grouping`, агрегация — стандартным
 * набором; группы раскрываются моделью дерева `rowExpandingModel`, которую эта модель
 * включает. Кнопка группировки в заголовке — у `rowGrouping`.
 */
import {
  columnGroupingFeature,
  type GroupingState,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import { aggregationFeatures } from '../../shared/aggregation'
import { rowExpandingModel } from '../rowExpandingModel/registry'
import { createIdleAwareGroupedRowModel } from './groupedRowModel'
import { objectGroupingFeature } from './objectGrouping'

export interface RowGroupingModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Колонки группировки по порядку: задаёт приложение; без него срез хранит грид. */
  grouping?: GroupingState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onGroupingChange?: (next: GroupingState) => void
  /** Начальное значение среза, которым владеет грид. */
  initialGrouping?: GroupingState
}

/** Фичи модели группировки; интерфейс несёт те же — по ним выводится тип среза. */
export const rowGroupingModelFeatures = {
  columnGroupingFeature,
  objectGroupingFeature,
  groupedRowModel: createIdleAwareGroupedRowModel(),
  ...aggregationFeatures,
}

const NO_GROUPING: string[] = []

export const rowGroupingModel = definePlugin<RowGroupingModelOptions>()({
  id: 'rowGroupingModel',
  // В серверной модели группирует сервер (ADR 0144): модели здесь группировать нечего.
  diagnose: serverRowModelReason,
  // Группы раскрывает модель дерева; её срез `expanded` — её аргумент (MP10).
  model: { plugin: rowExpandingModel, keys: [] },
  features: rowGroupingModelFeatures,
  slices: ['grouping'],
  // Выключенная модель не группирует: TanStack группирует по срезу и при
  // `enableGrouping: false`, поэтому эффективный срез пуст, сохранённый не меняется.
  narrow: o =>
    o.enabled === false
      ? {
          // Пустой срез — как есть: новая ссылка сбросила бы страницу (PG10).
          grouping: (value?: string[]) => (value?.length ? NO_GROUPING : value),
        }
      : undefined,
  options: o => ({
    enableGrouping: o.enabled !== false,
    groupRows: o.enabled !== false,
    groupedColumnMode: false,
  }),
})
