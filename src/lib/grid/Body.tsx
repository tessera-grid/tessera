// Body: контейнер тела. Виртуализация приходит пропсами (virtualRows/virtualColumns
// считает DataGrid), Body лишь маппит строки в BodyRow; декораторы плагинов оборачивают
// строку и незагруженную строку (ADR 0168, §2).
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
import { type DropPreview, findDropParent } from '../core/dragSession'
import { LoadMoreError } from '../ui/LoadMoreError/LoadMoreError'
import { RowMotion } from './rowMotion/RowMotion'
import { useDecorators, wrappersOf } from './pluginWrappers'
import { hasStickyRows, StickyRows } from './StickyRows'
import { isPlaceholderRow } from '../core/lazyPlaceholder'
import { FailedRow, PendingRow } from './PendingRow'
import { getTreeAria } from './treeAria'
import { rowCellsOf } from './rowCells'
import { useWindowData } from '../core/bodyContributions'
import { useActiveCellIndex } from '../core/keyboardNavigation'
import { useRowPortions } from './rowPortions'
import { isIncremental } from '../core/virtualization/windowPortions'

import styles from '../grid/Body/Body.module.css'

interface TableBodyProps {
  table: Table<any, any>
  layout: 'grid' | 'flex'
  /**
   * Весь список, если он загружен целиком: дерево, линии, движение и место броска. Геттером:
   * dev-журнал React обошёл бы массив в пропсах (ADR 0199, MS12).
   */
  getRows: () => Row<any, any>[]
  rowSource: RowSource<Row<any, any>>
  virtualRows: VirtualItem[]
  /** Видимые строки окна: смена окна целиком рисуется порциями (ADR 0203). */
  visibleRows?: { startIndex: number; endIndex: number } | null
  virtualColumns: VirtualItem[]
  leafColumns: Column<any, any, unknown>[]
  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  cellSlot?: CellSlot
  actionRowSlot?: CellSlot
  /** `aria-rowindex` первой строки тела минус 1: строки шапки + строки прошлых страниц. */
  ariaRowIndexBase: number
  /** Строки несут aria-level/setsize/posinset (treegrid). */
  treeRows?: boolean
  /** Ветки линий дерева (ADR 0102). */
  isResizingColumns: false | string
  isVirtualColumns: boolean
  /** Движение строк при смене модели (ADR 0107). */
  rowAnimation?: boolean
  /** Перетаскиваемая строка и место броска (ADR 0108). */
  dropPreview?: DropPreview | null
}

const NO_FAILURES: readonly RowFailure[] = []

export const Body = ({
  table,
  layout,
  getRows,
  rowSource,
  virtualRows,
  visibleRows,
  virtualColumns,
  leafColumns,
  leftCellSlot,
  rightCellSlot,
  cellSlot,
  actionRowSlot,
  ariaRowIndexBase,
  treeRows,
  isVirtualColumns,
  rowAnimation = false,
  dropPreview,
}: TableBodyProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const wrappers = wrappersOf(table)
  const decoratedRow = useDecorators(wrappers.rowDecorator, BodyRow, 'Row')
  const decoratedPending = useDecorators(
    wrappers.pendingRowDecorator,
    PendingRow,
    'Row',
  )
  const rows = getRows()
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
  const rowCount = rowSource.count()
  const drop = dropPreview ?? null
  const labels = useLocalization()
  const failures = rowSource.failures?.() ?? NO_FAILURES
  const failedAt = (index: number) =>
    failures.some(failure => index >= failure.start && index < failure.end)
  const shownIds = new Set<string>()
  const drawnRows = useRowPortions({
    rows: virtualRows,
    visible: visibleRows ?? null,
    activeIndex: useActiveCellIndex(table, 'rowIndex'),
    cellsPerRow: virtualColumns.length || leafColumns.length,
    enabled: isIncremental(table),
  })
  const first = virtualRows[0]?.index ?? 0
  const last = virtualRows[virtualRows.length - 1]?.index ?? -1
  // Данные строк окна от плагинов — линии дерева (ADR 0170, §3).
  const windowData = useWindowData(
    { table, rows, rowSource, rowCount, drop },
    { first, last },
  )
  // Будущий родитель слота подсвечен (ADR 0109, §4).
  // Строки — по источнику: у серверной модели массива строк нет (ADR 0159, §4).
  const dropParent =
    drop?.acceptable && drop.depth > 0
      ? findDropParent(rowSource, drop, first)
      : -1
  return (
    <div
      ref={bodyRef}
      className={clsx('data-grid__body', styles.body)}
      role="rowgroup"
      data-layout={layout}
      // Порции окна ещё ставятся (ADR 0203): тесты и снимки ждут конца.
      data-portions-pending={drawnRows.length < virtualRows.length || undefined}
    >
      <ColumnWindowContext.Provider value={virtualColumns}>
        {hasStickyRows(table) && virtualRows.length > 0 && (
          <StickyRows
            table={table}
            source={rowSource}
            rowHeight={virtualRows[0]!.size}
            renderRow={(entry, { last, pushed }) => (
              <BodyRow
                key={`sticky-${entry.row.id}`}
                copy
                stickyLast={last}
                stickyPushed={pushed}
                layout={layout}
                row={entry.row}
                virtualRow={{
                  key: `sticky-${entry.row.id}`,
                  index: entry.index,
                  start: entry.top,
                  end: entry.top + virtualRows[0]!.size,
                  size: virtualRows[0]!.size,
                  lane: 0,
                }}
                cells={rowCellsOf(table, entry.row)}
                leafColumns={leafColumns}
                leftCellSlot={leftCellSlot}
                rightCellSlot={rightCellSlot}
                cellSlot={cellSlot}
                actionRowSlot={actionRowSlot}
                ariaRowIndexBase={ariaRowIndexBase}
                isVirtualColumns={isVirtualColumns}
              />
            )}
          />
        )}
        <RowMotion
          enabled={rowAnimation}
          getRows={getRows}
          source={rowSource}
          listVersion={rowSource.version?.()}
          virtualRows={virtualRows}
          bodyRef={bodyRef}
        >
          {drawnRows.map(virtualRow => {
            // Строка на двух местах сразу — посреди переноса в серверной модели: второе место —
            // скелет, пока источник не сойдётся (ключ строки — её id).
            const found = rowSource.at(virtualRow.index)
            const row = found && !shownIds.has(found.id) ? found : undefined
            if (row) shownIds.add(row.id)
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
            // Строка ещё не загружена (ADR 0138, §5): скелет на её месте — с линиями дерева
            // её места (ADR 0161, §2).
            if (!row) {
              const place = windowData.skeletonOf(virtualRow.index)
              const pendingProps = {
                tree: treeRows ? sourceAria?.(virtualRow.index) : undefined,
                skeletonTree: place ? { ...place, parent: false } : undefined,
                window: place ? windowData.rowOf(virtualRow.index) : undefined,
                table,
                layout,
                virtualRow,
                leafColumns,
                virtualColumns,
                isVirtualColumns,
                ariaRowIndexBase,
              }
              const key = `pending-${virtualRow.index}`
              return decoratedPending ? (
                <decoratedPending.Outer
                  key={key}
                  {...pendingProps}
                  Row={decoratedPending.Inner}
                />
              ) : (
                <PendingRow key={key} {...pendingProps} />
              )
            }
            // Ленивые дети в пути (ADR 0155, §3): скелет-строка с отступом ребёнка.
            if (isPlaceholderRow(row)) {
              return (
                <PendingRow
                  key={row.id}
                  table={table}
                  layout={layout}
                  virtualRow={virtualRow}
                  leafColumns={leafColumns}
                  virtualColumns={virtualColumns}
                  isVirtualColumns={isVirtualColumns}
                  ariaRowIndexBase={ariaRowIndexBase}
                  tree={
                    treeRows
                      ? { level: row.depth + 1, posInSet: 1, setSize: 1 }
                      : undefined
                  }
                  skeletonTree={{
                    depth: row.depth,
                    branch: '',
                    open: false,
                    parent: false,
                  }}
                  window={windowData.rowOf(virtualRow.index)}
                />
              )
            }
            const isActive = drop?.activeId === row.id
            const rowProps = {
              layout,
              row,
              virtualRow,
              cells: rowCellsOf(table, row),
              leafColumns,
              leftCellSlot,
              rightCellSlot,
              cellSlot,
              actionRowSlot,
              ariaRowIndexBase,
              treeSetSize: treeAria?.setSize(virtualRow.index),
              treePosInSet: treeAria?.posInSet(virtualRow.index),
              window: windowData.rowOf(virtualRow.index, isActive),
              slotDepth: isActive ? drop.depth : undefined,
              dropParent: virtualRow.index === dropParent || undefined,
              isVirtualColumns,
            }
            return decoratedRow ? (
              <decoratedRow.Outer
                key={row.id}
                {...rowProps}
                Row={decoratedRow.Inner}
              />
            ) : (
              <BodyRow key={row.id} {...rowProps} />
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
