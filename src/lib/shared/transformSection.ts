/**
 * Раздел «Настроек вида» по записи преобразования колонок (ADR 0215, §3; ADR 0204, §2): уровни сортировки
 * или группировки по порядку — колонка, описание уровня, отметка скрытой колонки, снятие уровня и
 * сброс тем же путём, что действие пользователя плагина. Общий для `columnSorting` и `rowGrouping`.
 */
import type { ColumnTransform } from '../core/columnTransforms'
import type { TableLabels } from '../core/localization'
import {
  type ViewSettingsSection,
  type ViewSettingsLevel,
  countViewSettingsValue,
} from '../core/viewSettings'

export interface TransformSectionConfig {
  id: string
  order: number
  plugin: string
  icon: string
  transform: ColumnTransform
  /** Срез состояния с уровнями: колонки в порядке уровней. */
  slice: 'sorting' | 'grouping'
  labels: (labels: TableLabels) => {
    title: string
    remove: (column: string) => string
    reset: string
  }
}

interface SectionColumn {
  columnDef: { header?: unknown }
  getIsVisible?: () => boolean
}

interface SectionTable {
  atoms: Record<string, { get: () => unknown } | undefined>
  getColumn: (id: string) => SectionColumn | undefined
}

const idOf = (level: unknown) =>
  typeof level === 'string' ? level : (level as { id: string }).id

interface Item {
  columnId: string
  header: string
  hidden: boolean
}

/** Уровни по порядку; колонка, которой нет в описании, не показывается. */
const itemsOf = (table: unknown, slice: string): Item[] => {
  const t = table as SectionTable
  const levels = (t.atoms[slice]?.get() ?? []) as unknown[]
  const items: Item[] = []
  for (const level of levels) {
    const columnId = idOf(level)
    const column = t.getColumn(columnId)
    if (!column) continue
    const { header } = column.columnDef
    items.push({
      columnId,
      header: typeof header === 'string' ? header : columnId,
      hidden: column.getIsVisible?.() === false,
    })
  }
  return items
}

export const transformSection = (
  config: TransformSectionConfig,
): ViewSettingsSection => {
  const { transform, slice } = config
  const describe = (table: unknown, labels: TableLabels, item: Item) => {
    const state = transform.of(table, item.columnId)
    return state ? transform.describe(labels, state) : undefined
  }
  return {
    id: config.id,
    order: config.order,
    plugin: config.plugin,
    icon: config.icon,
    slices: [slice, 'columnVisibility'],
    label: labels => config.labels(labels).title,
    active: table => itemsOf(table, slice).length > 0,
    value: (table, labels) =>
      countViewSettingsValue(labels, itemsOf(table, slice).length),
    description: (table, labels) => {
      const items = itemsOf(table, slice)
      if (items.length === 0) return labels.viewSettingsNone
      return items
        .map(item =>
          [item.header, describe(table, labels, item)]
            .filter(Boolean)
            .join(' '),
        )
        .join('; ')
    },
    levels: (table, labels): ViewSettingsLevel[] =>
      itemsOf(table, slice).map(item => ({
        id: item.columnId,
        label: item.header,
        description: describe(table, labels, item),
        hidden: item.hidden,
        removeLabel: config.labels(labels).remove(item.header),
        remove: source => transform.clear(table, [item.columnId], source),
      })),
    reset: {
      label: labels => config.labels(labels).reset,
      run: (table, source) =>
        transform.clear(
          table,
          itemsOf(table, slice).map(item => item.columnId),
          source,
        ),
    },
  }
}
