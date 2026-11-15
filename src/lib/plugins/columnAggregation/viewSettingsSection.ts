/**
 * Раздел «Сводка» «Настроек вида» (ADR 0230, §6): уровни — колонки с выбором в срезе в порядке
 * колонок, описание — функция; снятие уровня возвращает функцию по умолчанию, «Сбросить» — все.
 */
import type { TableLabels } from '../../core/localization'
import {
  countViewSettingsValue,
  type ViewSettingsLevel,
  type ViewSettingsSection,
} from '../../core/viewSettings'
import { chooseAggregation } from './choose'
import type { ColumnAggregationsState } from './feature'
import {
  type AggregationColumn,
  canSummarize,
  functionLabel,
} from './functions'
import { columnAggregationLabels } from './labels'

interface SectionColumn extends AggregationColumn {
  columnDef: AggregationColumn['columnDef'] & { header?: unknown }
  getIsVisible?: () => boolean
}

interface SectionTable {
  atoms: { columnAggregations?: { get: () => ColumnAggregationsState } }
  getAllLeafColumns: () => SectionColumn[]
}

interface Item {
  column: SectionColumn
  name: string | null
}

const itemsOf = (table: unknown): Item[] => {
  const t = table as SectionTable
  const choice = t.atoms.columnAggregations?.get() ?? {}
  return t
    .getAllLeafColumns()
    .filter(column => Object.hasOwn(choice, column.id))
    .map(column => ({ column, name: choice[column.id] ?? null }))
}

const headerOf = (column: SectionColumn) =>
  typeof column.columnDef.header === 'string'
    ? column.columnDef.header
    : column.id

const describe = (table: unknown, labels: TableLabels, item: Item) =>
  item.name === null
    ? columnAggregationLabels(labels).noSummary
    : functionLabel(table, item.name, labels)

export const summarySection: ViewSettingsSection = {
  id: 'summary',
  order: 35,
  plugin: 'columnAggregation',
  icon: 'summary',
  slices: ['columnAggregations', 'columnVisibility', 'grouping'],
  label: labels => columnAggregationLabels(labels).summary,
  visible: table =>
    (table as SectionTable)
      .getAllLeafColumns()
      .some(column => canSummarize(table, column)),
  active: table => itemsOf(table).length > 0,
  value: (table, labels) =>
    countViewSettingsValue(labels, itemsOf(table).length),
  description: (table, labels) => {
    const items = itemsOf(table)
    if (items.length === 0) return labels.viewSettingsNone
    return items
      .map(item => `${headerOf(item.column)} ${describe(table, labels, item)}`)
      .join('; ')
  },
  levels: (table, labels): ViewSettingsLevel[] =>
    itemsOf(table).map(item => ({
      id: item.column.id,
      label: headerOf(item.column),
      description: describe(table, labels, item),
      hidden: item.column.getIsVisible?.() === false,
      removeLabel: columnAggregationLabels(labels).removeSummary(
        headerOf(item.column),
      ),
      remove: source =>
        chooseAggregation(table, [item.column.id], undefined, source),
    })),
  reset: {
    label: labels => columnAggregationLabels(labels).resetSummary,
    run: (table, source) =>
      chooseAggregation(
        table,
        itemsOf(table).map(item => item.column.id),
        undefined,
        source,
      ),
  },
}
