/**
 * Смена группировки действием пользователя (ADR 0144, §3): в серверной модели строк id групп
 * другой группировки не совпадают — раскрытие и выбор сброшены (ADR 0148, §4); отказ
 * возвращает оба. Её зовут кнопка заголовка и снятие преобразования колонки (ADR 0204, §2).
 */
import type { ColumnTransform } from '../../core/columnTransforms'
import { reportAction } from '../../core/debugActions'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import {
  isSelectionEmpty,
  rowSelectionValueOf,
  setRowSelectionValue,
} from '../../core/rowSelectionAll'
import { runServerAction } from '../../core/serverActions'
import { rowGroupingLabels } from './labels'

interface GroupingTable {
  atoms: { grouping?: { get: () => string[] | undefined } }
  setGrouping: (grouping: string[]) => void
  resetExpanded: (defaultState?: boolean) => void
}

const groupingOf = (table: unknown): string[] =>
  (table as GroupingTable).atoms.grouping?.get() ?? []

export const changeGrouping = (
  table: unknown,
  apply: () => void,
  cause: { columns: string[]; menu?: boolean },
) =>
  runServerAction(
    table,
    'grouping',
    () => {
      apply()
      if (serverRowModelReason(table)) {
        ;(table as GroupingTable).resetExpanded(true)
        if (!isSelectionEmpty(rowSelectionValueOf(table))) {
          setRowSelectionValue(table, {})
        }
      }
    },
    () => undefined,
    { control: 'rowGrouping', ...cause },
  )

/** Группировка по колонке — запись факта преобразований: уровень среди уровней. */
export const groupTransform: ColumnTransform = {
  kind: 'group',
  name: labels => rowGroupingLabels(labels).transformName,
  describe: (labels, { index, count }) =>
    count && count > 1 && index
      ? `${rowGroupingLabels(labels).transformDescription}, ${rowGroupingLabels(labels).transformLevel(index, count)}`
      : rowGroupingLabels(labels).transformDescription,
  icon: () => 'grouped',
  of: (table, columnId) => {
    const grouping = groupingOf(table)
    const index = grouping.indexOf(columnId)
    return index < 0 ? undefined : { index: index + 1, count: grouping.length }
  },
  clear: (table, columnIds, source) => {
    const grouping = groupingOf(table)
    const next = grouping.filter(id => !columnIds.includes(id))
    if (next.length === grouping.length) return
    reportAction(table, {
      plugin: 'rowGrouping',
      action: 'ungroup',
      detail: { columnIds: [...columnIds] },
      source,
    })
    changeGrouping(table, () => (table as GroupingTable).setGrouping(next), {
      columns: [...columnIds],
    })
  },
}
