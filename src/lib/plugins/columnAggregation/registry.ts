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
  /** `false` disables the plugin: the columns' own functions apply. */
  enabled?: boolean
  /** Function choice set by the application; without it the grid keeps the slice. */
  columnAggregations?: ColumnAggregationsState
  /** New slice value after each change from inside the grid. */
  onColumnAggregationsChange?: (next: ColumnAggregationsState) => void
  /** Initial value of the slice the grid owns. */
  initialColumnAggregations?: ColumnAggregationsState
  /** Custom functions by name; the name is sent to the server like built-in names. */
  functions?: Record<string, ColumnAggregationFunction>
  /** Whether a column's summary can be changed; `false` — no item (SU6). */
  canSummarizeColumn?: (column: AggregationColumn) => boolean
  /**
   * A server refusal reverts the choice (true by default); `false` — the new choice stays (ADR 0116).
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
