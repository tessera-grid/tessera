/**
 * Счётчик выбранных строк в нижней панели (ADR 0038, RS19–RS22). Не live-область:
 * выбор уже объявляется самим плагином (`announceSelection`). Выбранные строки,
 * которые не проходят фильтр, называются отдельно (ADR 0045, FL17).
 */
import type { RowSelectionState } from '@tanstack/react-table'

import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { StatusBarCount } from '../../grid/StatusBar/StatusBarCount'
import { Skeleton } from '../../ui/Skeleton'

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

export const SelectedRowsCount = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  const selection = useTableState(
    table,
    state => state.rowSelection as RowSelectionState | undefined,
  )
  useTableState(table, state => [state.columnFilters, state.globalFilter])
  if (isSkeletonShown(table)) {
    return (
      <span data-testid="selected-rows-count">
        <Skeleton width={80} height="var(--tsr-comp-skeleton-text-height)" />
      </span>
    )
  }

  const count = countSelectedRows(selection)
  const hidden = count > 0 ? countHiddenSelectedRows(table, selection) : 0

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
