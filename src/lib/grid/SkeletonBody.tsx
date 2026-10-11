// SkeletonBody: тело и футер скелета первой загрузки (ADR 0060) — лёгкие ячейки без
// строк TanStack, по тем же переменным ширин, закреплению и диапазону виртуализатора
// колонок. Шапку рисует сама таблица в режиме скелета (DataGridTable).
import {
  type CSSProperties,
  type ReactNode,
  memo,
  useRef,
  useState,
} from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { CommonColumnDef } from '../core/commonFeature.types'
import {
  getSkeletonBarWidth,
  getSkeletonRowCount,
  resolveSkeletonOptions,
  type SkeletonOptions,
} from '../core/skeletonOptions'
import { ESTIMATE_SIZE } from '../core/virtualization/measureRows'
import { Skeleton } from '../ui/Skeleton'
import type { Column, Table } from '../types'
import { CellWrapperContent, getAlignContent } from './CellWrapperContent'
import { getCellPinningParams, pinnedSideToDom } from './cellPinningParams'
import { getColumnSizeVariable } from './columnSizes'
import { needsRightFiller } from './layout'
import { RightFillerBodyColumn } from './RightFillerBodyColumn'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'

import bodyStyles from '../grid/Body/Body.module.css'
import bodyRowStyles from '../grid/BodyRow/BodyRow.module.css'
import bodyCellStyles from '../grid/BodyCell/BodyCell.module.css'
import footerStyles from '../grid/Footer/Footer.module.css'
import footerCellStyles from '../grid/FooterCell/FooterCell.module.css'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'
import { inertProp } from '../core/inertProp'

/** Сторона квадрата на месте контрола служебной колонки, px. */
const CONTROL_SIZE = 16
const BAR_HEIGHT = 16

interface SkeletonColumn {
  id: string
  placement: 'start' | 'center' | 'end' | 'flow'
  flex: ReturnType<typeof getAlignContent>
  isActionsColumn: boolean
  content: ReactNode
  style: CSSProperties
  attrs: Record<string, unknown>
}

/**
 * `shape`: строка тела — полоска или квадрат контрола; футер — полоска, где есть
 * `footer`. `wave` — бегущий блик первой загрузки; хвост ленты статичен, как
 * скелет-ячейки быстрой прокрутки.
 */
const cellContent = (
  column: Column<any, any, unknown>,
  shape: boolean,
  wave: boolean,
) => {
  if (column.getIsActionsColumn()) {
    return shape &&
      (column.columnDef as CommonColumnDef).skeletonCell === 'control' ? (
      <Skeleton width={CONTROL_SIZE} height={CONTROL_SIZE} />
    ) : null
  }
  return shape ? (
    <Skeleton
      width={`${getSkeletonBarWidth(column.id)}%`}
      height={BAR_HEIGHT}
      animation={wave && 'wave'}
    />
  ) : null
}

/** Колонки ряда скелета: закреплённые — в потоке, центральные — по `left`. */
const getSkeletonColumns = (
  table: Table<any, any>,
  layout: 'grid' | 'flex',
  leafColumns: Column<any, any, unknown>[],
  virtualColumns: VirtualItem[],
  isVirtualColumns: boolean,
  shape: (column: Column<any, any, unknown>) => boolean,
  wave = true,
): SkeletonColumn[] => {
  const describe = (
    column: Column<any, any, unknown>,
    placement: SkeletonColumn['placement'],
    absoluteLeft?: number,
  ): SkeletonColumn => {
    const pinning = getCellPinningParams(table as never, column as never)
    const size = `var(${getColumnSizeVariable(column.id)})`
    const isActionsColumn = column.getIsActionsColumn()
    return {
      id: column.id,
      placement,
      isActionsColumn,
      flex: getAlignContent({
        isActionsColumn,
        isRowActionsColumn: column.getIsRowActionsColumn(),
      }),
      content: cellContent(column, shape(column), wave),
      style: {
        width: size,
        ...(absoluteLeft !== undefined
          ? { left: absoluteLeft }
          : {
              minWidth: size,
              left: pinning.startPinnedOffset,
              right: pinning.endPinnedOffset,
            }),
      },
      attrs: {
        'data-column-id': column.id,
        'data-virtual-cell': absoluteLeft !== undefined || undefined,
        'data-cell-pinned': pinnedSideToDom(column.getIsPinned()),
        'data-cell-last-left-pinned': pinning.isLastStartPinnedColumn,
        'data-cell-last-right-pinned': pinning.isLastEndPinnedColumn,
        'data-cell-first-right-pinned': pinning.isFirstEndPinnedColumn,
        'data-cell-alone-right-pinned': pinning.isAloneEndPinnedColumn,
        'data-actions-column-cell': isActionsColumn,
        'data-layout': layout,
        'data-first-cell-in-row': column.getIsFirstColumn(),
        'data-last-cell-in-row': column.getIsLastColumn(),
      },
    }
  }

  if (!isVirtualColumns) {
    return leafColumns.map(column => describe(column, 'flow'))
  }
  const columns: SkeletonColumn[] = []
  for (const virtualColumn of virtualColumns) {
    const column = leafColumns[virtualColumn.index]
    if (!column) continue
    const pinned = column.getIsPinned()
    columns.push(
      pinned === 'start'
        ? describe(column, 'start')
        : pinned === 'end'
          ? describe(column, 'end')
          : describe(column, 'center', virtualColumn.start),
    )
  }
  return columns
}

interface SkeletonCellsProps {
  columns: SkeletonColumn[]
  isVirtualColumns: boolean
  className: string
  moduleClassName: string | undefined
  /** Номер строки тела; у футера нет. */
  rowIndex?: number
  rowCount?: number
  filler?: ReactNode
}

const SkeletonCells = ({
  columns,
  isVirtualColumns,
  className,
  moduleClassName,
  rowIndex,
  rowCount,
  filler,
}: SkeletonCellsProps) => {
  const odd = rowIndex !== undefined && rowIndex % 2 !== 0
  const renderCell = (column: SkeletonColumn) => (
    <div
      key={column.id}
      className={clsx(className, moduleClassName)}
      style={column.style}
      {...column.attrs}
      {...(rowIndex !== undefined && {
        'data-cell-of-first-row': rowIndex === 0,
        'data-cell-of-last-row': rowIndex === (rowCount ?? 0) - 1,
        'data-cell-odd-left-pinned': odd && column.placement === 'start',
        'data-cell-odd-right-pinned': odd && column.placement === 'end',
      })}
    >
      <CellWrapperContent
        flex={column.flex}
        smallPadding={column.isActionsColumn}
      >
        {column.content}
      </CellWrapperContent>
    </div>
  )
  if (!isVirtualColumns) {
    return (
      <>
        {columns.map(renderCell)}
        {filler}
      </>
    )
  }
  const of = (placement: SkeletonColumn['placement']) =>
    columns.filter(column => column.placement === placement).map(renderCell)
  return (
    <>
      {of('start')}
      <VirtualCenterSpacer />
      {of('center')}
      {of('end')}
    </>
  )
}

interface SkeletonRowsBlockProps {
  layout: 'grid' | 'flex'
  columns: SkeletonColumn[]
  cellsVirtual: boolean
  filler: ReactNode
  rowCount: number
  /** Номер первой строки: чётность полос продолжает тело. */
  firstRowIndex?: number
  className?: string
  /** `false` — только высота блока, без строк (блок вне области прокрутки). */
  cells?: boolean
}

/** Блок строк скелета высотой в `rowCount` строк темы. */
const SkeletonRowsBlock = ({
  layout,
  columns,
  cellsVirtual,
  filler,
  rowCount,
  firstRowIndex = 0,
  className,
  cells = true,
}: SkeletonRowsBlockProps) => (
  <div
    className={clsx(className, bodyStyles.body)}
    data-layout={layout}
    style={{ height: `calc(var(--tsr-comp-row-height) * ${rowCount})` }}
  >
    {Array.from({ length: cells ? rowCount : 0 }, (_, rowIndex) => (
      <div
        key={rowIndex}
        className={clsx(
          'data-grid__body-row--skeleton',
          bodyRowStyles.body__row,
        )}
        data-row-odd={(firstRowIndex + rowIndex) % 2 !== 0}
        data-layout={layout}
        style={{
          top: `calc(var(--tsr-comp-row-height) * ${rowIndex})`,
        }}
      >
        <SkeletonCells
          columns={columns}
          isVirtualColumns={cellsVirtual}
          className="data-grid__body-cell--skeleton"
          moduleClassName={bodyCellStyles.body__cell}
          rowIndex={firstRowIndex + rowIndex}
          rowCount={firstRowIndex + rowCount}
          filler={filler}
        />
      </div>
    ))}
  </div>
)

const bodyFillerOf = (
  leafColumns: Column<any, any, unknown>[],
  isVirtualColumns: boolean,
) =>
  !isVirtualColumns && needsRightFiller(leafColumns.at(-1)) ? (
    <RightFillerBodyColumn hasBorderTop hasBorderRight />
  ) : null

export interface SkeletonRowsProps {
  table: Table<any, any>
  layout: 'grid' | 'flex'
  leafColumns: Column<any, any, unknown>[]
  virtualColumns: VirtualItem[]
  isVirtualColumns: boolean
  rowCount: number
  /** Номер первой строки в теле: чётность полос продолжает тело. */
  firstRowIndex: number
  className?: string
  /** `false` — хвост вне области прокрутки: только его высота, как у тела вне окна. */
  cells?: boolean
}

/**
 * Строки скелета после тела (хвост догрузки, ADR 0081): колонки, ширины и
 * закрепление — как у тела. Скрыты от вспомогательных технологий и неинтерактивны.
 */
export const SkeletonRows = memo(
  ({
    table,
    layout,
    leafColumns,
    virtualColumns,
    isVirtualColumns,
    rowCount,
    firstRowIndex,
    className,
    cells = true,
  }: SkeletonRowsProps) => (
    <div
      aria-hidden="true"
      {...inertProp(true)}
      style={{ display: 'contents' }}
    >
      <SkeletonRowsBlock
        layout={layout}
        columns={getSkeletonColumns(
          table,
          layout,
          leafColumns,
          virtualColumns,
          isVirtualColumns,
          () => true,
          false,
        )}
        cellsVirtual={isVirtualColumns}
        filler={bodyFillerOf(leafColumns, isVirtualColumns)}
        rowCount={rowCount}
        firstRowIndex={firstRowIndex}
        className={className}
        cells={cells}
      />
    </div>
  ),
)
SkeletonRows.displayName = 'SkeletonRows'

interface SkeletonBodyProps {
  table: Table<any, any>
  layout: 'grid' | 'flex'
  leafColumns: Column<any, any, unknown>[]
  virtualColumns: VirtualItem[]
  isVirtualColumns: boolean
}

/** Высота строки из темы грида; без темы — оценка виртуализатора. */
const readRowHeight = (node: HTMLElement) =>
  Number.parseFloat(
    getComputedStyle(node).getPropertyValue('--tsr-comp-row-height'),
  ) || ESTIMATE_SIZE

export const SkeletonBody = memo(
  ({
    table,
    layout,
    leafColumns,
    virtualColumns,
    isVirtualColumns,
  }: SkeletonBodyProps) => {
    const rootRef = useRef<HTMLDivElement>(null)
    const options = table.options as {
      skeletonOptions?: SkeletonOptions
      enableFooter?: boolean
    }
    const { rowsCount, columnsCount } = resolveSkeletonOptions(
      options.skeletonOptions,
    )
    const pageSize = (
      table.atoms as { pagination?: { get: () => { pageSize: number } } }
    ).pagination?.get().pageSize
    const footerRows = options.enableFooter ? 1 : 0

    // Строки по высоте области прокрутки: минус шапка и футер.
    const [space, setSpace] = useState<{ body: number; row: number }>()
    useIsomorphicLayoutEffect(() => {
      const scroller = rootRef.current?.closest<HTMLElement>(
        '.data-grid__container',
      )
      if (!scroller) return
      const measure = () => {
        const head =
          scroller.querySelector<HTMLElement>('.data-grid__head')
            ?.offsetHeight ?? 0
        const row = readRowHeight(scroller)
        setSpace(prev => {
          const body = scroller.clientHeight - head - footerRows * row
          return prev?.body === body && prev.row === row ? prev : { body, row }
        })
      }
      measure()
      const observer = new ResizeObserver(measure)
      observer.observe(scroller)
      return () => observer.disconnect()
    }, [footerRows])

    const rowCount = space
      ? getSkeletonRowCount({
          rowsCount,
          bodyHeight: space.body,
          rowHeight: space.row,
          pageSize,
        })
      : 0

    const hasColumns = leafColumns.length > 0
    const columns = hasColumns
      ? getSkeletonColumns(
          table,
          layout,
          leafColumns,
          virtualColumns,
          isVirtualColumns,
          () => true,
        )
      : Array.from({ length: columnsCount }, (_, index): SkeletonColumn => ({
          id: `skeleton-${index}`,
          placement: 'flow',
          flex: undefined,
          isActionsColumn: false,
          content: <Skeleton width="60%" height={BAR_HEIGHT} />,
          style: { flex: 1, minWidth: 0 },
          attrs: { 'data-layout': layout },
        }))
    const cellsVirtual = hasColumns && isVirtualColumns
    const bodyFiller = hasColumns
      ? bodyFillerOf(leafColumns, isVirtualColumns)
      : null

    const footerGroup = options.enableFooter
      ? table.getFooterGroups().at(0)
      : undefined
    const footerColumns =
      footerGroup && hasColumns
        ? getSkeletonColumns(
            table,
            layout,
            leafColumns,
            virtualColumns,
            isVirtualColumns,
            column => !!column.columnDef.footer,
          )
        : undefined

    return (
      <div
        ref={rootRef}
        className="data-grid__body--skeleton"
        aria-hidden="true"
        {...inertProp(true)}
        style={{ display: 'contents' }}
      >
        <SkeletonRowsBlock
          layout={layout}
          columns={columns}
          cellsVirtual={cellsVirtual}
          filler={bodyFiller}
          rowCount={rowCount}
        />
        {footerColumns && (
          <div
            className={clsx('data-grid__footer--skeleton', footerStyles.footer)}
            data-layout={layout}
          >
            <div style={{ display: 'contents' }}>
              <SkeletonCells
                columns={footerColumns}
                isVirtualColumns={cellsVirtual}
                className="data-grid__footer-cell--skeleton"
                moduleClassName={footerCellStyles.footer__cell}
              />
            </div>
          </div>
        )}
      </div>
    )
  },
)

SkeletonBody.displayName = 'SkeletonBody'
