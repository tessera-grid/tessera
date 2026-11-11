/**
 * Раздел «Фильтр» «Настроек вида» (ADR 0215, §1): условия колонок — колонка, текст условия, отметка скрытой
 * колонки, снятие условия и «Сбросить фильтры» путями пользователя плагина (ADR 0045, §5).
 */
import { formatDataTypeValue } from '../../core/dataTypeFormat'
import type { TableLabels } from '../../core/localization'
import { DRAFTS_KEY } from '../../core/drafts/drafts'
import {
  type ViewSettingsSection,
  countViewSettingsValue,
} from '../../core/viewSettings'
import {
  setColumnFilterByUser,
  setColumnFiltersByUser,
} from '../../shared/filtering/filtering'
import { filteringLabels } from '../../shared/filtering/labels'
import { filterOptionLabelOf } from '../columnFilteringModel/options'
import { describeFilter } from './describeFilter'
import { filterDraftCount } from './filterDraft'
import { type FilterSummaryItem, filterSummaryOf } from './filterSummary'
import { columnFilteringLabels } from './labels'

const conditionOf = (
  table: unknown,
  labels: TableLabels,
  item: FilterSummaryItem,
) =>
  describeFilter(item.filter, labels, {
    locale: (table as { options: { dateLocale?: { code?: string } } }).options
      .dateLocale?.code,
    optionLabel: value =>
      filterOptionLabelOf(table as never, item.column as never, value),
    numberText: value =>
      formatDataTypeValue(table as never, item.column, value, undefined),
  })

export const filterSection: ViewSettingsSection = {
  id: 'filter',
  order: 10,
  plugin: 'columnFiltering',
  icon: 'filter',
  slices: ['columnFilters', 'columnVisibility', DRAFTS_KEY],
  label: labels => columnFilteringLabels(labels).filters,
  active: table => filterSummaryOf(table).length > 0,
  value: (table, labels) =>
    countViewSettingsValue(
      labels,
      filterSummaryOf(table).length,
      filterDraftCount(table),
    ),
  description: (table, labels) => {
    const items = filterSummaryOf(table)
    if (items.length === 0) return labels.viewSettingsNone
    return items
      .map(item => `${item.header} ${conditionOf(table, labels, item)}`)
      .join('; ')
  },
  levels: (table, labels) =>
    filterSummaryOf(table).map(item => ({
      id: item.columnId,
      label: item.header,
      description: conditionOf(table, labels, item),
      hidden: item.hidden,
      removeLabel: columnFilteringLabels(labels).removeFilter(item.header),
      remove: () => setColumnFilterByUser(table, item.columnId, undefined),
    })),
  reset: {
    label: labels => filteringLabels(labels).resetFilters,
    run: table => setColumnFiltersByUser(table, []),
  },
}
