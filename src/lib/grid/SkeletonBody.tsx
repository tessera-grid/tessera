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
import { useTableState } from '../core/reactivity'
import { ROW_NESTING_INDENT_TOKEN } from '../core/rowNesting'
import {
  type SkeletonTreeRow,
  getSkeletonColumnId,
  getSkeletonRowCount,
  getSkeletonTreeRows,
  isSkeletonParentRow,
  resolveSkeletonOptions,
  type SkeletonOptions,
} from '../core/skeletonOptions'
import { ESTIMATE_SIZE } from '../core/virtualization/measureRows'
import { isIndentColumn } from './cellExpandingStyles'
import { renderSkeletonCell, skeletonCellKindOf } from './skeletonCell'
import { TreeLines } from './TreeLinesLayer'
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
import { getFooterPosition } from '../core/footer'
import footerStyles from '../grid/Footer/Footer.module.css'
import footerCellStyles from '../grid/FooterCell/FooterCell.module.css'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'
import { inertProp } from '../core/inertProp'

interface SkeletonColumn {
  id: string
  placement: 'start' | 'center' | 'end' | 'flow'
  flex: ReturnType<typeof getAlignContent>
  isActionsColumn: boolean
  /** Колонка отступа вложенности: сдвиг и линии подстрок дерева. */
  isIndent: boolean
  /** Колонка раскрытия: в дереве квадрат только у строк с подстроками. */
  isToggle: boolean
  content: ReactNode
  style: CSSProperties
  attrs: Record<string, unknown>
}

/**
 * `shape`: строка тела — по виду ячейки колонки; футер — где есть `footer`. `wave` —
 * бегущий блик первой загрузки; хвост ленты статичен, как скелет быстрой прокрутки.
 */
const cellContent = (
  column: Column<any, any, unknown>,
  shape: boolean,
  wave: boolean,
) =>
  shape ? renderSkeletonCell(column.id, skeletonCellKindOf(column), wave) : null

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
      isIndent: isIndentColumn(column, table),
      isToggle:
        (column.columnDef as CommonColumnDef).serviceLabel === 'expandColumn',
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
  /** Строка дерева скелета (ADR 0119, SL22). */
  tree?: SkeletonTreeRow
  treeLines?: boolean
  /** Квадрат в колонке раскрытия; без значения — у каждой строки. */
  toggle?: boolean
}

const SkeletonCells = ({
  columns,
  isVirtualColumns,
  className,
  moduleClassName,
  rowIndex,
  rowCount,
  filler,
  tree,
  treeLines,
  toggle,
}: SkeletonCellsProps) => {
  const odd = rowIndex !== undefined && rowIndex % 2 !== 0
  const renderCell = (column: SkeletonColumn) => {
    const nested = tree && column.isIndent && tree.depth > 0
    const lines =
      !!tree && column.isIndent && !!treeLines && (tree.depth > 0 || tree.open)
    return (
      <div
        key={column.id}
        className={clsx(className, moduleClassName)}
        style={
          nested
            ? {
                ...column.style,
                paddingLeft: `calc(var(${ROW_NESTING_INDENT_TOKEN}) * ${tree.depth})`,
              }
            : column.style
        }
        {...column.attrs}
        data-tree-depth={lines ? tree!.depth : undefined}
        {...(rowIndex !== undefined && {
          'data-cell-of-first-row': rowIndex === 0,
          'data-cell-of-last-row': rowIndex === (rowCount ?? 0) - 1,
          'data-cell-odd-left-pinned': odd && column.placement === 'start',
          'data-cell-odd-right-pinned': odd && column.placement === 'end',
        })}
      >
        {lines && <TreeLines branch={tree!.branch} open={tree!.open} />}
        <CellWrapperContent
          flex={column.flex}
          smallPadding={column.isActionsColumn}
        >
          {column.isToggle && (tree ? !tree.parent : toggle === false)
            ? null
            : column.content}
        </CellWrapperContent>
      </div>
    )
  }
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
  /** План строк дерева (ADR 0119, SL22). */
  tree?: SkeletonTreeRow[]
  treeLines?: boolean
  /** Квадраты раскрытия вразброс по номеру строки (плоский скелет, SL25). */
  scatterToggles?: boolean
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
  tree,
  treeLines,
  scatterToggles,
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
          tree={tree?.[rowIndex]}
          treeLines={treeLines}
          toggle={
            scatterToggles
              ? isSkeletonParentRow(firstRowIndex + rowIndex)
              : undefined
          }
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
      enableTreeLines?: boolean
      rowHeight?: number
      headerHeight?: number
    }
    const { rowsCount, columnsCount } = resolveSkeletonOptions(
      options.skeletonOptions,
    )
    // Дерево придёт развёрнутым: `expanded: true` (ADR 0119, SL22). Без модели дерева
    // или с выключенной срез пуст — сужение `narrowExpandingOff`.
    const tree = useTableState(
      table as never,
      state => (state as { expanded?: unknown }).expanded === true,
    )
    const pageSize = (
      table.atoms as { pagination?: { get: () => { pageSize: number } } }
    ).pagination?.get().pageSize
    const footerRows = options.enableFooter ? 1 : 0

    // Строки по высоте области прокрутки: минус шапка и футер. Новая высота строки или
    // шапки размер области не меняет — замер повторяется и по ним (SL26).
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
    }, [footerRows, options.rowHeight, options.headerHeight])

    const rowCount = space
      ? getSkeletonRowCount({
          rowsCount,
          bodyHeight: space.body,
          rowHeight: space.row,
          pageSize,
        })
      : 0

    const hasColumns = leafColumns.length > 0
    const treeRows =
      tree && hasColumns ? getSkeletonTreeRows(rowCount) : undefined
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
          id: getSkeletonColumnId(index),
          placement: 'flow',
          flex: undefined,
          isActionsColumn: false,
          isIndent: false,
          isToggle: false,
          content: renderSkeletonCell(getSkeletonColumnId(index), 'bar', true),
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
          tree={treeRows}
          treeLines={options.enableTreeLines}
          scatterToggles={!treeRows}
        />
        {footerColumns && (
          <div
            className={clsx('data-grid__footer--skeleton', footerStyles.footer)}
            data-layout={layout}
            data-position={getFooterPosition(table)}
            data-skeleton=""
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
