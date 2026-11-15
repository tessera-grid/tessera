/**
 * Запись плагина columnAggregation на `definePlugin` (ADR 0230): выбор функции агрегата колонки
 * пользователем — «Сводка». Срез `columnAggregations` главнее `aggregationFn` колонки и задаёт итог
 * колонки и значения строк-групп; пункт в кебабе заголовка, раздел «Настроек вида», имя функции у
 * итога. В серверной модели выбор — серверное действие с откатом.
 */
import { announcerLabels } from '../../core/announcer'
import { definePlugin } from '../../core/definePlugin'
import { ENGLISH_LABELS } from '../../core/localization'
import { neverInert } from '../../core/pluginDiagnostics'
import { declareRevertOnReject } from '../../core/serverActions'
import { aggregationFeatures } from '../../shared/aggregation'
import {
  type ColumnAggregationFunction,
  columnAggregationFeature,
  type ColumnAggregationsState,
} from './feature'
import {
  type AggregationColumn,
  currentNameOf,
  functionLabel,
} from './functions'
import { summaryHeaderAction } from './headerAction'
import { columnAggregationLabels } from './labels'
import { summarySection } from './viewSettingsSection'

export interface ColumnAggregationOptions {
  /** `false` — плагин отключён: действуют функции колонок. */
  enabled?: boolean
  /** Выбор функций: задаёт приложение; без него срез хранит грид. */
  columnAggregations?: ColumnAggregationsState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onColumnAggregationsChange?: (next: ColumnAggregationsState) => void
  /** Начальное значение среза, которым владеет грид. */
  initialColumnAggregations?: ColumnAggregationsState
  /** Свои функции по имени; имя уходит серверу, как имена встроенных. */
  functions?: Record<string, ColumnAggregationFunction>
  /** Сводку колонки можно менять; `false` — пункта нет (SU6). */
  canSummarizeColumn?: (column: AggregationColumn) => boolean
  /**
   * Отказ сервера откатывает выбор (по умолчанию true); `false` — выбор остаётся новым (ADR 0116).
   */
  revertOnReject?: boolean
}

const NO_CHOICE: ColumnAggregationsState = {}

/** Имя функции у итога колонки (§4): «Без сводки» — без подписи, итога всё равно нет. */
const totalLabel = (table: unknown, columnId: string) => {
  const column = (
    table as { getColumn: (id: string) => AggregationColumn | undefined }
  ).getColumn(columnId)
  if (!column) return undefined
  const name = currentNameOf(table, column)
  if (name === null) return undefined
  return functionLabel(table, name, announcerLabels(table) ?? ENGLISH_LABELS)
}

export const columnAggregation = definePlugin<ColumnAggregationOptions>()({
  id: 'columnAggregation',
  labels: [columnAggregationLabels],
  actions: {
    resetSummary: labels => columnAggregationLabels(labels).resetSummary,
  },
  diagnose: neverInert,
  features: { columnAggregationFeature, ...aggregationFeatures },
  slices: ['columnAggregations'],
  // Выключенный плагин выбора не применяет: сохранённый срез не меняется.
  narrow: o =>
    o.enabled === false
      ? {
          columnAggregations: (value?: ColumnAggregationsState) =>
            value && Object.keys(value).length ? NO_CHOICE : value,
        }
      : undefined,
  setup: o => table =>
    declareRevertOnReject(
      table,
      'columnAggregations',
      o.revertOnReject !== false,
    ),
  slotActions: [summaryHeaderAction],
  viewSettingsSections: [summarySection],
  options: o => ({
    columnAggregationFunctions: o.functions,
    canSummarizeColumn:
      o.enabled === false ? () => false : o.canSummarizeColumn,
    columnTotalLabel: o.enabled === false ? undefined : totalLabel,
  }),
})
