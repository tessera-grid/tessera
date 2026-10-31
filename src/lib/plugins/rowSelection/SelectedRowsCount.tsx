/**
 * Счётчик выбранных строк в нижней панели (ADR 0038, RS19–RS22). Не live-область:
 * выбор уже объявляется самим плагином (`announceSelection`). Выбранные строки,
 * которые не проходят фильтр, называются отдельно (ADR 0045, FL17).
 */
import type { RowSelectionState } from '@tanstack/react-table'

import type { StatusBarComponentProps } from '../../core/createSlots'
import { pluginStateKey } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { GROUP_ROW_PREFIX, type RowSource } from '../../core/rowSource'
import {
  allSelectionOf,
  countSelectionIn,
  selectionPartsOf,
} from '../../core/rowSelectionAll'
import { useSlice, useTableState } from '../../core/reactivity'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { StatusBarCount } from '../../ui/StatusBarCount/StatusBarCount'
import { Skeleton } from '../../ui/Skeleton'
import {
  groupingLength,
  subRowsOf,
} from '../rowSelectionModel/selectionHelpers'

/** Выбранные `id` среза, а не строки модели: выбор на других страницах тоже считается. */
export const countSelectedRows = (selection: RowSelectionState | undefined) =>
  Object.values(selection ?? {}).filter(Boolean).length

interface FilteredTable {
  getCoreRowModel: () => { rowsById: Record<string, unknown> }
  getFilteredRowModel?: () => { flatRows: { id: string }[] }
}

/** Выбранные строки данных, которых нет в отфильтрованной модели. */
export const countHiddenSelectedRows = (
  table: unknown,
  selection: RowSelectionState | undefined,
) => {
  const t = table as FilteredTable
  const selected = Object.keys(selection ?? {}).filter(id => selection![id])
  if (!t.getFilteredRowModel || selected.length === 0) return 0
  const { rowsById } = t.getCoreRowModel()
  const visible = new Set(t.getFilteredRowModel().flatRows.map(row => row.id))
  return selected.filter(id => id in rowsById && !visible.has(id)).length
}

/**
 * Строк в списке для «всё, кроме»: итог, а пока он неизвестен — строк в списке. При
 * серверной группировке — строки данных выборки из ответа; без них — `undefined` (ADR 0144).
 */
const listTotalOf = (table: unknown) => {
  const source = (table as { getRowSource: () => RowSource }).getRowSource()
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
  const source = (table as { getRowSource: () => RowSource }).getRowSource()
  const row = source.byId(GROUP_ROW_PREFIX + JSON.stringify(keys))
  return row === undefined ? undefined : source.groupChildCount?.(row)
}

export const SelectedRowsCount = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  // Атом среза: в нём эффективное значение, и для «всё, кроме» (ADR 0138, §9).
  const selection = useSlice(table, 'rowSelection') as
    RowSelectionState | undefined
  useTableState(table, state => [state.columnFilters, state.globalFilter])
  // Итог серверной модели строк меняется с приходом блоков (ADR 0138, §9).
  useTableState(
    table,
    state =>
      (state as unknown as Record<string, unknown>)[
        pluginStateKey('serverRowModel')
      ],
  )
  if (isSkeletonShown(table)) {
    return (
      <span data-testid="selected-rows-count">
        <Skeleton width={80} height="var(--tsr-comp-skeleton-text-height)" />
      </span>
    )
  }

  const all = allSelectionOf(selection)
  const source = (table as { getRowSource: () => RowSource }).getRowSource()
  const exact = all
    ? countSelectionIn(all, groupSizeOf(table), id => source.subtreeSize?.(id))
    : undefined
  // Размер нужной группы или ветки неизвестен: «все, кроме k» или «N строк и k групп» —
  // либо «… и k веток» (ADR 0148, §3; ADR 0162, §4).
  if (all && exact === undefined) {
    const { rows, groups, branches, excluded } = selectionPartsOf(all)
    const groupsLabel =
      branches > 0
        ? labels.selectedBranchesCount(branches)
        : labels.selectedGroupsCount(groups)
    return (
      <StatusBarCount
        data-testid="selected-rows-count"
        full={
          all.all
            ? labels.selectedAllExcept(excluded)
            : labels.selectedRowsAndGroups(rows, groupsLabel)
        }
        short={
          all.all
            ? labels.selectedAllExceptShort(excluded)
            : labels.selectedRowsAndGroupsShort(rows, groupsLabel)
        }
      />
    )
  }
  const count = exact ?? countSelectedRows(selection)
  const hidden =
    !all && count > 0 ? countHiddenSelectedRows(table, selection) : 0

  // Пустой счётчик держит место слота: панель не теряет строку (RS21, SB14).
  if (count === 0) return <span data-testid="selected-rows-count" />
  const hiddenFull = hidden > 0 ? `, ${labels.selectedRowsHidden(hidden)}` : ''
  const hiddenShort =
    hidden > 0 ? `, ${labels.selectedRowsHiddenShort(hidden)}` : ''
  return (
    <StatusBarCount
      data-testid="selected-rows-count"
      full={labels.selectedRows(count) + hiddenFull}
      short={labels.selectedRowsShort(count) + hiddenShort}
    />
  )
}
