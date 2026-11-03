/**
 * Число выбранных строк — одно для счётчика нижней панели и объявления выбора (ADR 0038,
 * RS19; ADR 0138, SD51): у «всё, кроме» — по итогу списка и размерам групп и веток.
 */
import type { RowSelectionState } from '@tanstack/react-table'

import { knownCount, partialRowsReason, rowCountOf } from '../../core/dataMode'
import type { TableLabels } from '../../core/localization'
import {
  allSelectionOf,
  countSelectionIn,
  selectionPartsOf,
} from '../../core/rowSelectionAll'
import { dataRowSourceOf, GROUP_ROW_PREFIX } from '../../core/rowSource'
import { groupingLength, subRowsOf } from './selectionHelpers'

/** Выбранные `id` среза, а не строки модели: выбор на других страницах тоже считается. */
export const countSelectedRows = (selection: RowSelectionState | undefined) =>
  Object.values(selection ?? {}).filter(Boolean).length

/**
 * Строк в списке для «всё, кроме»: итог, а пока он неизвестен — строк в списке. При
 * серверной группировке — строки данных выборки из ответа; без них — `undefined` (ADR 0144).
 * Страница с сервера и лента — итог `rowCount` таблицы, неизвестен — `undefined` (ADR 0179).
 */
const listTotalOf = (table: unknown) => {
  const partial = partialRowsReason(table)
  if (partial === 'serverPage' || partial === 'feed')
    return knownCount(rowCountOf(table))
  const source = dataRowSourceOf(table)
  if (source.leafCount && groupingLength(table) > 0) return source.leafCount()
  // С `subRows` «Выбрать всё» берёт и вложенные строки — строки всего дерева (ADR 0162, §4).
  if (source.subtreeSize && subRowsOf(table))
    return source.subtreeSize(undefined)
  // В дереве серверной модели «Выбрать всё» — итог корней (ADR 0138, §14).
  const total = source.rootCount?.() ?? source.total?.() ?? source.count()
  return total < 0 ? source.count() : total
}

/**
 * Строк данных в группе пути `keys` (ADR 0148, §3): у корня — итог списка, у группы
 * последнего уровня — её число строк от сервера; у групп выше — неизвестно.
 */
const groupSizeOf = (table: unknown) => (keys: readonly unknown[]) => {
  if (keys.length === 0) return listTotalOf(table)
  if (keys.length !== groupingLength(table)) return undefined
  const source = dataRowSourceOf(table)
  const row = source.byId(GROUP_ROW_PREFIX + JSON.stringify(keys))
  return row === undefined ? undefined : source.groupChildCount?.(row)
}

/** Выбор числом строк или, пока размер нужной группы или ветки неизвестен, частями. */
export type SelectionSummary =
  { count: number } | ({ all: boolean } & ReturnType<typeof selectionPartsOf>)

/** Выбор среза: атом хранит эффективное значение, и для «всё, кроме» (ADR 0138, §9). */
export const selectionSummaryOf = (
  table: unknown,
  selection: RowSelectionState | undefined,
): SelectionSummary => {
  const all = allSelectionOf(selection)
  if (!all) return { count: countSelectedRows(selection) }
  const source = dataRowSourceOf(table)
  const count = countSelectionIn(all, groupSizeOf(table), id =>
    source.subtreeSize?.(id),
  )
  return count === undefined
    ? { all: all.all, ...selectionPartsOf(all) }
    : { count }
}

/** «Все, кроме k» или «N строк и k групп» — либо «… и k веток» (ADR 0148, §3; ADR 0162, §4). */
export const selectionPartsLabel = (
  labels: TableLabels,
  parts: Exclude<SelectionSummary, { count: number }>,
  short = false,
) => {
  const groups =
    parts.branches > 0
      ? labels.selectedBranchesCount(parts.branches)
      : labels.selectedGroupsCount(parts.groups)
  if (parts.all) {
    return short
      ? labels.selectedAllExceptShort(parts.excluded)
      : labels.selectedAllExcept(parts.excluded)
  }
  return short
    ? labels.selectedRowsAndGroupsShort(parts.rows, groups)
    : labels.selectedRowsAndGroups(parts.rows, groups)
}
