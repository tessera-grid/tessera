/**
 * Незагруженная строка серверной модели (ADR 0138, §5, §8): строка таблицы со сквозным
 * `aria-rowindex` и `aria-busy`, скелет по раскладке колонок — для глаз. Активная ячейка
 * клавиатурной навигации может стоять на ней: ячейка во всю строку берёт фокус в колонке
 * активной ячейки, пришедший блок отдаёт его настоящей ячейке.
 */
import type { VirtualItem } from '@tanstack/react-virtual'

import { getDisplayColumns } from '../core/displayColumns'
import {
  NAV_CELL_ATTR,
  useKeyboardNavigationCell,
} from '../core/keyboardNavigation'
import { resolveActive, type NavTable } from '../core/keyboardNavigation/model'
import { useLocalization } from '../core/localization'
import { useTableState } from '../core/reactivity'
import type { Column, Table } from '../types'
import { SkeletonRows } from './SkeletonBody'

import styles from '../grid/Body/Body.module.css'

interface PendingRowProps {
  table: Table<any, any>
  layout: 'grid' | 'flex'
  virtualRow: VirtualItem
  leafColumns: Column<any, any, unknown>[]
  virtualColumns: VirtualItem[]
  isVirtualColumns: boolean
  ariaRowIndexBase: number
  /** Место незагруженной строки в дереве (treegrid, ADR 0138, §14). */
  tree?: { level: number; posInSet: number; setSize: number }
}

/** Ячейка навигации незагруженной строки: колонка — та, где стоит активная ячейка. */
const PendingCell = ({
  table,
  rowIndex,
  colSpan,
}: {
  table: Table<any, any>
  rowIndex: number
  colSpan: number
}) => {
  const labels = useLocalization()
  const columnId = useTableState(table, state => {
    const t = table as unknown as NavTable
    const active = resolveActive(t, state as unknown as Record<string, unknown>)
    return getDisplayColumns(t).ids[active.columnIndex] ?? ''
  }) as string
  const nav = useKeyboardNavigationCell(table, rowIndex, columnId)
  return (
    <div
      ref={nav?.ref}
      role={nav ? 'gridcell' : 'cell'}
      aria-colspan={colSpan || undefined}
      aria-label={labels.loading}
      className={styles.pendingCell}
      tabIndex={nav?.tabIndex}
      onFocus={nav?.onFocus}
      onBlur={nav?.onBlur}
      {...(nav && { [NAV_CELL_ATTR]: '' })}
      data-kn-active={nav?.isActive || undefined}
    />
  )
}

export const PendingRow = ({
  table,
  layout,
  virtualRow,
  leafColumns,
  virtualColumns,
  isVirtualColumns,
  ariaRowIndexBase,
  tree,
}: PendingRowProps) => (
  <div
    role="row"
    aria-rowindex={ariaRowIndexBase + virtualRow.index + 1}
    aria-level={tree?.level}
    aria-posinset={tree?.posInSet}
    aria-setsize={tree?.setSize}
    aria-busy="true"
    className={styles.pending}
    style={{ top: virtualRow.start }}
    data-index={virtualRow.index}
    data-pending-row=""
  >
    <SkeletonRows
      table={table}
      layout={layout}
      leafColumns={leafColumns}
      virtualColumns={virtualColumns}
      isVirtualColumns={isVirtualColumns}
      rowCount={1}
      firstRowIndex={virtualRow.index}
    />
    <PendingCell
      table={table}
      rowIndex={virtualRow.index}
      colSpan={leafColumns.length}
    />
  </div>
)

/**
 * Строка отказавшего блока (ADR 0138, §11): пустая рамка строки под строкой ошибки —
 * без полосок скелета, скрыта от вспомогательных технологий.
 */
export const FailedRow = ({
  table,
  layout,
  virtualRow,
  leafColumns,
  virtualColumns,
  isVirtualColumns,
}: Omit<PendingRowProps, 'ariaRowIndexBase'>) => (
  <div
    className={styles.pending}
    style={{ top: virtualRow.start }}
    data-index={virtualRow.index}
    data-failed-row=""
  >
    <SkeletonRows
      table={table}
      layout={layout}
      leafColumns={leafColumns}
      virtualColumns={virtualColumns}
      isVirtualColumns={isVirtualColumns}
      rowCount={1}
      firstRowIndex={virtualRow.index}
      empty
    />
  </div>
)
