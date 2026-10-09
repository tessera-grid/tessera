/**
 * «Показано N из M» в нижней панели (ADR 0045, §7, FL16): слот общий для
 * `columnFiltering` и `quickSearch` (дедупликация по `id`). Есть, пока активен фильтр
 * колонки или поиск; N — строки верхнего уровня после фильтрации, M — до неё. В
 * серверном режиме оба числа даёт приложение (FL30); без них элемента нет.
 */
import type { StatusBarComponentProps } from '../../core/createSlots'
import { isFilteringActive } from '../../core/filtering'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { StatusBarCount } from '../StatusBar/StatusBarCount'

export const FILTERED_ROWS_COUNT_SLOT_ID = 'filteredRowsCount'

interface CountTable {
  options: {
    manualFiltering?: boolean
    filteringRowCounts?: { filtered?: number; total?: number }
  }
  getFilteredRowModel?: () => { rows: unknown[] }
  getPreFilteredRowModel?: () => { rows: unknown[] }
}

const countsOf = (table: CountTable) => {
  if (table.options.manualFiltering) {
    const { filtered, total } = table.options.filteringRowCounts ?? {}
    return filtered === undefined || total === undefined
      ? undefined
      : { filtered, total }
  }
  if (!table.getFilteredRowModel || !table.getPreFilteredRowModel) {
    return undefined
  }
  return {
    filtered: table.getFilteredRowModel().rows.length,
    total: table.getPreFilteredRowModel().rows.length,
  }
}

export const FilteredRowsCount = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  const filtering = useTableState(table, isFilteringActive)
  const counts = filtering
    ? countsOf(table as unknown as CountTable)
    : undefined
  if (!counts) return null

  return (
    <StatusBarCount
      data-testid="filtered-rows-count"
      full={labels.filteredRows(counts.filtered, counts.total)}
      short={labels.filteredRowsShort(counts.filtered, counts.total)}
    />
  )
}

export const filteredRowsCountSlot = {
  id: FILTERED_ROWS_COUNT_SLOT_ID,
  slot: 'statusBarSlot' as const,
  align: 'start' as const,
  order: 0,
  component: FilteredRowsCount,
}
