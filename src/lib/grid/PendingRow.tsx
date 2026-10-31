/**
 * Незагруженная строка серверной модели (ADR 0138, §5, §8): строка таблицы со сквозным
 * `aria-rowindex` и `aria-busy`, скелет по раскладке колонок — для глаз. Активная ячейка
 * клавиатурной навигации может стоять на ней: ячейка во всю строку берёт фокус в колонке
 * активной ячейки, пришедший блок отдаёт его настоящей ячейке.
 */
import { type CSSProperties, useMemo } from 'react'

import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'

import { getDisplayColumns } from '../core/displayColumns'
import {
  NAV_CELL_ATTR,
  useKeyboardNavigationCell,
} from '../core/keyboardNavigation'
import { resolveActive, type NavTable } from '../core/keyboardNavigation/model'
import { useLocalization } from '../core/localization'
import type { PendingRowDragBinding } from '../core/pluginWrappers'
import { useTableState } from '../core/reactivity'
import type { Column, Table } from '../types'
import type { WindowRow } from '../core/bodyContributions'
import type { SkeletonTreeRow } from '../core/skeletonOptions'
import { type SkeletonCellExtra, SkeletonRows } from './SkeletonBody'

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
  /** Отступ и линии дерева скелета — у скелет-строки ленивых детей (ADR 0155, §3). */
  skeletonTree?: SkeletonTreeRow
  /** Данные строки окна от плагинов — линии дерева её места (ADR 0170, §3). */
  window?: WindowRow
  /** Место под указателем перетаскивания от декоратора плагина (ADR 0168, §2). */
  drag?: PendingRowDragBinding
}

interface SelectionBounds {
  minRowIndex: number
  maxRowIndex: number
  minColumnIndex: number
  maxColumnIndex: number
}

interface SelectionTable {
  getCellSelectionBounds?: () => SelectionBounds[]
  getCellSelectionColumnIndexes?: () => Record<string, number>
}

const within = (bounds: SelectionBounds[], row: number, column: number) =>
  bounds.some(
    b =>
      row >= b.minRowIndex &&
      row <= b.maxRowIndex &&
      column >= b.minColumnIndex &&
      column <= b.maxColumnIndex,
  )

/**
 * Выделенные колонки незагруженной строки с кромками диапазона (ADR 0146, §3): строка
 * `id:сверху справа снизу слева` на колонку — стабильна для подписки.
 */
const selectionOf = (table: unknown, row: number): string => {
  const t = table as SelectionTable
  const bounds = t.getCellSelectionBounds?.()
  if (!bounds?.length) return ''
  const parts: string[] = []
  for (const [id, column] of Object.entries(
    t.getCellSelectionColumnIndexes?.() ?? {},
  )) {
    if (!within(bounds, row, column)) continue
    const edges = [
      !within(bounds, row - 1, column),
      !within(bounds, row, column + 1),
      !within(bounds, row + 1, column),
      !within(bounds, row, column - 1),
    ]
    parts.push(`${id}:${edges.map(Number).join('')}`)
  }
  return parts.join('|')
}

const edgeColor = (on: string) =>
  on === '1' ? 'var(--tsr-comp-cell-selected-border-color)' : 'transparent'

/** Атрибуты выделения ячеек скелета — как у ячеек тела (BodyCell). */
const selectionExtra = (
  selection: string,
): ((columnId: string) => SkeletonCellExtra | undefined) | undefined => {
  if (!selection) return undefined
  const byColumn = new Map(
    selection.split('|').map(part => {
      const at = part.lastIndexOf(':')
      return [part.slice(0, at), part.slice(at + 1)] as const
    }),
  )
  return columnId => {
    const edges = byColumn.get(columnId)
    if (!edges) return undefined
    return {
      attrs: { 'data-cell-selected': 'true' },
      style: {
        '--tsr-sel-edge-top': edgeColor(edges[0]!),
        '--tsr-sel-edge-right': edgeColor(edges[1]!),
        '--tsr-sel-edge-bottom': edgeColor(edges[2]!),
        '--tsr-sel-edge-left': edgeColor(edges[3]!),
      } as CSSProperties,
    }
  }
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
  skeletonTree,
  window,
  drag,
}: PendingRowProps) => {
  // Выделение по индексам заливает и незагруженную строку (ADR 0146, §3).
  const selection = useTableState(table, () =>
    selectionOf(table, virtualRow.index),
  ) as string
  const cellExtra = useMemo(() => selectionExtra(selection), [selection])
  return (
    <div
      ref={drag?.setNodeRef}
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
        cellExtra={cellExtra}
        tree={skeletonTree && [skeletonTree]}
        window={window}
      />
      <PendingCell
        table={table}
        rowIndex={virtualRow.index}
        colSpan={leafColumns.length}
      />
    </div>
  )
}

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
