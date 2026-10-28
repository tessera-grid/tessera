// Body: контейнер тела. Виртуализация приходит пропсами (virtualRows/virtualColumns
// считает DataGrid), Body лишь маппит строки в BodyRow/DraggableBodyRow. При
// enableRowDragging рисуется DraggableBodyRow (useSortable под DndContext тела),
// иначе обычная BodyRow.
import { memo, useMemo, useRef } from 'react'

import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'
import clsx from 'clsx'

import type { Column, Row, Table } from '../types'
import type { CellSlot } from '../core/createSlots'
import { isKeyboardNavigationEnabled } from '../core/keyboardNavigation'
import { useLocalization } from '../core/localization'
import type { RowFailure, RowSource } from '../core/rowSource'
import { BodyRow } from './BodyRow'
import { ColumnWindowContext } from './columnWindow'
import { DraggableBodyRow } from './DraggableBodyRow'
import { findDropParent } from './dnd/dropParent'
import { LoadMoreError } from './LoadMoreError'
import { RowMotion } from './rowMotion/RowMotion'
import { FailedRow, PendingRow } from './PendingRow'
import { getTreeAria } from './treeAria'
import { getTreeLines, projectTreeLines } from './treeBranches'

import styles from '../grid/Body/Body.module.css'

interface TableBodyProps {
  table: Table<any, any>
  layout: 'grid' | 'flex'
  /** Весь список, если он загружен целиком: дерево, линии, движение и место броска. */
  rows: Row<any, any>[]
  rowSource: RowSource<Row<any, any>>
  virtualRows: VirtualItem[]
  virtualColumns: VirtualItem[]
  leafColumns: Column<any, any, unknown>[]
  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  cellSlot?: CellSlot
  actionRowSlot?: CellSlot
  /** `aria-rowindex` первой строки тела минус 1: строки шапки + строки прошлых страниц. */
  ariaRowIndexBase: number
  selectableRows?: boolean
  /** Строки несут aria-level/setsize/posinset (treegrid). */
  treeRows?: boolean
  /** Ветки линий дерева (ADR 0102). */
  treeLines?: boolean
  isResizingColumns: false | string
  isVirtualColumns: boolean
  enableRowDragging?: boolean
  /** Движение строк при смене модели (ADR 0107). */
  rowAnimation?: boolean
  /** Перетаскиваемая строка и место броска (ADR 0108). */
  dropPreview?: DropPreview | null
}

export interface DropPreview {
  activeId: string
  /** Индексы в `rows`: откуда строку взяли и куда она встанет. */
  from: number
  to: number
  depth: number
  acceptable: boolean
}

const NO_FAILURES: readonly RowFailure[] = []

/** Позиция строки `index` после переноса `from` → `to` (как `arrayMove`). */
const positionAfterMove = (index: number, from: number, to: number) => {
  if (index === from) return to
  if (from < to && index > from && index <= to) return index - 1
  if (from > to && index >= to && index < from) return index + 1
  return index
}

export const Body = ({
  table,
  layout,
  rows,
  rowSource,
  virtualRows,
  virtualColumns,
  leafColumns,
  leftCellSlot,
  rightCellSlot,
  cellSlot,
  actionRowSlot,
  ariaRowIndexBase,
  selectableRows,
  treeRows,
  treeLines,
  isVirtualColumns,
  enableRowDragging,
  rowAnimation = false,
  dropPreview,
}: TableBodyProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const RowComponent = enableRowDragging ? DraggableBodyRow : BodyRow
  // Серверная модель строк считает `aria-*` дерева сама: массива строк у неё нет
  // (ADR 0138, §14).
  const sourceAria = rowSource.treeAria
  const treeAria = useMemo(
    () =>
      !treeRows
        ? undefined
        : sourceAria
          ? {
              setSize: (index: number) => sourceAria(index)?.setSize ?? 1,
              posInSet: (index: number) => sourceAria(index)?.posInSet ?? 1,
            }
          : getTreeAria(rows),
    [treeRows, rows, sourceAria],
  )
  const treeLinesIndex = useMemo(
    () => (treeLines ? getTreeLines(rows) : undefined),
    [treeLines, rows],
  )
  const drop = enableRowDragging ? dropPreview : null
  const labels = useLocalization()
  const failures = rowSource.failures?.() ?? NO_FAILURES
  const failedAt = (index: number) =>
    failures.some(failure => index >= failure.start && index < failure.end)
  const first = virtualRows[0]?.index ?? 0
  const last = virtualRows[virtualRows.length - 1]?.index ?? -1
  // Линии окна «как после броска» (ADR 0108, §4), и на недопустимом месте (ADR 0137, §4).
  const projected = useMemo(
    () =>
      treeLinesIndex && drop
        ? projectTreeLines(
            rows,
            treeLinesIndex,
            drop,
            Math.max(0, first - 1),
            Math.min(rows.length - 1, last + 1),
          )
        : undefined,
    [treeLinesIndex, rows, drop, first, last],
  )
  // Будущий родитель слота подсвечен (ADR 0109, §4).
  const dropParent =
    drop?.acceptable && drop.depth > 0 ? findDropParent(rows, drop, first) : -1
  const linesOf = (index: number, isActive: boolean) => {
    if (!drop || !projected) {
      return isActive && drop
        ? { branch: undefined, open: undefined }
        : {
            branch: treeLinesIndex?.branch(index),
            open: treeLinesIndex?.open(index),
          }
    }
    const position = positionAfterMove(index, drop.from, drop.to)
    return {
      branch: projected.branch(position),
      open: projected.open(position),
    }
  }

  return (
    <div
      ref={bodyRef}
      className={clsx('data-grid__body', styles.body)}
      role="rowgroup"
      data-layout={layout}
    >
      <ColumnWindowContext.Provider value={virtualColumns}>
        <RowMotion
          enabled={rowAnimation}
          rows={rows}
          virtualRows={virtualRows}
          bodyRef={bodyRef}
        >
          {virtualRows.map(virtualRow => {
            const row = rowSource.at(virtualRow.index)
            // Строка отказавшего блока — пустая рамка под его строкой ошибки (ADR 0138, §11).
            if (!row && failedAt(virtualRow.index)) {
              return (
                <FailedRow
                  key={`failed-${virtualRow.index}`}
                  table={table}
                  layout={layout}
                  virtualRow={virtualRow}
                  leafColumns={leafColumns}
                  virtualColumns={virtualColumns}
                  isVirtualColumns={isVirtualColumns}
                />
              )
            }
            // Строка ещё не загружена (ADR 0138, §5): скелет на её месте.
            if (!row) {
              return (
                <PendingRow
                  tree={treeRows ? sourceAria?.(virtualRow.index) : undefined}
                  key={`pending-${virtualRow.index}`}
                  table={table}
                  layout={layout}
                  virtualRow={virtualRow}
                  leafColumns={leafColumns}
                  virtualColumns={virtualColumns}
                  isVirtualColumns={isVirtualColumns}
                  ariaRowIndexBase={ariaRowIndexBase}
                />
              )
            }
            const isActive = drop?.activeId === row.id
            const lines = linesOf(virtualRow.index, isActive)
            return (
              <RowComponent
                key={row.id}
                layout={layout}
                row={row}
                virtualRow={virtualRow}
                visibleCells={row.getVisibleCells()}
                leafColumns={leafColumns}
                leftCellSlot={leftCellSlot}
                rightCellSlot={rightCellSlot}
                cellSlot={cellSlot}
                actionRowSlot={actionRowSlot}
                ariaRowIndexBase={ariaRowIndexBase}
                selectableRows={selectableRows}
                treeSetSize={treeAria?.setSize(virtualRow.index)}
                treePosInSet={treeAria?.posInSet(virtualRow.index)}
                treeBranch={lines.branch}
                treeOpen={lines.open}
                slotDepth={isActive ? drop.depth : undefined}
                dropParent={virtualRow.index === dropParent || undefined}
                isVirtualColumns={isVirtualColumns}
              />
            )
          })}
        </RowMotion>
      </ColumnWindowContext.Provider>
      {failures
        .filter(failure => failure.end > first && failure.start <= last)
        .map(failure => (
          <div
            key={`failed-${failure.start}`}
            role="presentation"
            className={styles.failed}
            style={{
              // От отрисованной строки: в растянутой области место — не индекс × высота.
              top:
                virtualRows[0].start +
                (failure.start - virtualRows[0].index) * virtualRows[0].size,
              height: `calc(var(--tsr-comp-row-height) * ${failure.end - failure.start})`,
            }}
          >
            <LoadMoreError
              className={styles.failedRow}
              title={labels.rowsLoadFailed}
              reason={failure.reason}
              retryLabel={labels.loadMoreRetry}
              onRetry={() => failure.retry()}
              ariaRowIndex={ariaRowIndexBase + failure.start + 1}
              colSpan={leafColumns.length}
              navigable={isKeyboardNavigationEnabled(table)}
              testId="rows-load-error"
            />
          </div>
        ))}
    </div>
  )
}

// Мемоизация активна только во время ресайза колонок.
export const MemoizedBody = memo(
  Body,
  (_, next) => next.isResizingColumns !== false,
)
MemoizedBody.displayName = 'MemoizedBody'
