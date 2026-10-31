/**
 * «Показано N из M» в нижней панели (ADR 0045, §7, FL16): слот общий для
 * `columnFiltering` и `quickSearch` (дедупликация по `id`). Есть, пока активен фильтр
 * колонки или поиск; N — строки верхнего уровня после фильтрации, M — до неё. С сервером
 * числа — из итогов таблицы `rowCount` и `totalRowCount` (FL30, ADR 0169); без них элемента
 * нет.
 */
import type { StatusBarComponentProps } from '../../core/createSlots'
import {
  dataModeOf,
  knownCount,
  rowCountOf,
  totalRowCountOf,
} from '../../core/dataMode'
import { isFilteringActive } from './filtering'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { StatusBarCount } from '../../ui/StatusBarCount/StatusBarCount'

export const FILTERED_ROWS_COUNT_SLOT_ID = 'filteredRowsCount'

interface CountTable {
  store: { get: () => { columnFilters?: unknown[]; globalFilter?: unknown } }
  getFilteredRowModel?: () => { rows: unknown[] }
  getPreFilteredRowModel?: () => { rows: unknown[] }
}

/** Клиент сужает строки сам: операция на клиенте и её срез не пуст. */
const narrowsOnClient = (table: CountTable) => {
  const { columnFilters, globalFilter } = table.store.get()
  return (
    (!!columnFilters?.length && dataModeOf(table, 'filtering') === 'client') ||
    (!!globalFilter && dataModeOf(table, 'search') === 'client')
  )
}

/**
 * Всё на клиенте — N и M по строкам `data`. С сервером M — итог `totalRowCount`, а N —
 * `rowCount`, если клиент ответ не сужает, иначе строки после клиентской операции
 * (ADR 0169, §4).
 */
const countsOf = (table: CountTable) => {
  const onServer =
    dataModeOf(table, 'filtering') === 'server' ||
    dataModeOf(table, 'search') === 'server'
  const clientRows = () =>
    table.getFilteredRowModel && table.getPreFilteredRowModel
      ? {
          filtered: table.getFilteredRowModel().rows.length,
          total: table.getPreFilteredRowModel().rows.length,
        }
      : undefined
  if (!onServer) return clientRows()
  const total = knownCount(totalRowCountOf(table))
  const filtered = narrowsOnClient(table)
    ? clientRows()?.filtered
    : knownCount(rowCountOf(table))
  return filtered === undefined || total === undefined
    ? undefined
    : { filtered, total }
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
