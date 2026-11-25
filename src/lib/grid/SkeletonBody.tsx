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

import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'
import clsx from 'clsx'

import { useTableState } from '../core/reactivity'
import { ROW_NESTING_INDENT_TOKEN } from '../core/rowNesting'
import {
  type SkeletonTreeRow,
  getSkeletonColumnId,
  getSkeletonRowCount,
  getSkeletonTreeRows,
  isSkeletonParentRow,
  resolveSkeletonOptions,
} from '../core/skeletonOptions'
import { ESTIMATE_SIZE } from '../core/virtualization/measureRows'
import { isIndentColumn } from './cellExpandingStyles'
import { renderSkeletonCell, skeletonCellKindOf } from './skeletonCell'
import { cellLayersOf, type WindowRow } from '../core/bodyContributions'
import type { Column, Table } from '../types'
import { CellWrapperContent, getAlignContent } from './CellWrapperContent'
import { getCellPinningParams, pinnedSideToDom } from './cellPinningParams'
import { getColumnSizeVariable, getVirtualCellLeft } from './columnSizes'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'

import bodyStyles from '../grid/Body/Body.module.css'
import bodyRowStyles from '../grid/BodyRow/BodyRow.module.css'
import bodyCellStyles from '../grid/BodyCell/BodyCell.module.css'
import { getFooterPosition } from '../core/footer'
import footerStyles from '../grid/Footer/Footer.module.css'
import footerCellStyles from '../grid/FooterCell/FooterCell.module.css'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'
import { inertProp } from '../core/inertProp'
import { estimatedRowHeightOf } from '../core/rowSizes'
import { pinnedCellClass } from './BodyCell/pinnedCellClass'

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
  leafColumns: Column<any, any, unknown>[],
  virtualColumns: VirtualItem[],
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
      isToggle: skeletonCellKindOf(column) === 'toggle',
      flex: getAlignContent({
        isActionsColumn,
        isFillColumn: !!column.getServiceColumn()?.fill,
      }),
      content: cellContent(column, shape(column), wave),
      style: {
        width: size,
        ...(absoluteLeft !== undefined
          ? { left: getVirtualCellLeft(column.id, absoluteLeft) }
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
        'data-first-cell-in-row': column.getIsFirstColumn(),
        'data-last-cell-in-row': column.getIsLastColumn(),
      },
    }
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
  /** Ячейки по окну колонок; без колонок таблицы — в потоке. */
  windowed: boolean
  className: string
  moduleClassName: string | undefined
  /** Класс стороны закрепления — у ячеек тела (ADR 0213). */
  pinnedClassName?: (start: boolean, end: boolean) => string | undefined
  /** Номер строки тела; у футера нет. */
  rowIndex?: number
  rowCount?: number
  filler?: ReactNode
  /** Строка дерева скелета (ADR 0119, SL22). */
  tree?: SkeletonTreeRow
  table: Table<any, any>
  /** Данные строки окна от плагинов — у строки на месте незагруженной (ADR 0170, §3). */
  window?: WindowRow
  /** Квадрат в колонке раскрытия; без значения — у каждой строки. */
  toggle?: boolean
}

const SkeletonCells = ({
  columns,
  windowed,
  className,
  moduleClassName,
  pinnedClassName,
  rowIndex,
  rowCount,
  filler,
  tree,
  table,
  window,
  toggle,
}: SkeletonCellsProps) => {
  const odd = rowIndex !== undefined && rowIndex % 2 !== 0
  const renderCell = (column: SkeletonColumn) => {
    const nested = tree && column.isIndent && tree.depth > 0
    // Слои плагинов — линии дерева строки скелета (ADR 0170, §3).
    const layers = cellLayersOf({
      table,
      columnId: column.id,
      isIndent: column.isIndent,
      depth: tree?.depth ?? 0,
      window,
      skeleton: tree,
    })
    return (
      <div
        key={column.id}
        className={clsx(
          className,
          moduleClassName,
          pinnedClassName?.(
            column.placement === 'start',
            column.placement === 'end',
          ),
        )}
        style={
          nested
            ? {
                ...column.style,
                paddingLeft: `calc(var(${ROW_NESTING_INDENT_TOKEN}) * ${tree.depth})`,
              }
            : column.style
        }
        {...column.attrs}
        {...layers.attrs}
        {...(rowIndex !== undefined && {
          'data-cell-of-first-row': rowIndex === 0,
          'data-cell-of-last-row': rowIndex === (rowCount ?? 0) - 1,
          'data-cell-odd-left-pinned': odd && column.placement === 'start',
          'data-cell-odd-right-pinned': odd && column.placement === 'end',
        })}
      >
        {layers.nodes}
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
  if (!windowed) {
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
  table: Table<any, any>
  window?: WindowRow
  /** Квадраты раскрытия вразброс по номеру строки (плоский скелет, SL25). */
  scatterToggles?: boolean
  rowClassName?: string
  /** Высота строк блока, px; нет — высота строки темы (ADR 0218, §8). */
  rowHeight?: number
}

/** Блок строк скелета высотой в `rowCount` строк темы. */
const SkeletonRowsBlock = ({
  columns,
  cellsVirtual,
  filler,
  rowCount,
  firstRowIndex = 0,
  className,
  cells = true,
  tree,
  table,
  window,
  scatterToggles,
  rowClassName = 'data-grid__body-row--skeleton',
  rowHeight,
}: SkeletonRowsBlockProps) => (
  <div
    className={clsx(className, bodyStyles.body)}
    style={{
      ...(rowHeight !== undefined && {
        '--tsr-comp-row-height': `${rowHeight}px`,
      }),
      height: `calc(var(--tsr-comp-row-height) * ${rowCount})`,
    }}
  >
    {Array.from({ length: cells ? rowCount : 0 }, (_, rowIndex) => (
      <div
        key={rowIndex}
        className={clsx(rowClassName, bodyRowStyles.body__row)}
        data-row-odd={(firstRowIndex + rowIndex) % 2 !== 0}
        style={{
          top: `calc(var(--tsr-comp-row-height) * ${rowIndex})`,
        }}
      >
        <SkeletonCells
          columns={columns}
          windowed={cellsVirtual}
          className="data-grid__body-cell--skeleton"
          moduleClassName={bodyCellStyles.body__cell}
          pinnedClassName={pinnedCellClass}
          rowIndex={firstRowIndex + rowIndex}
          rowCount={firstRowIndex + rowCount}
          filler={filler}
          tree={tree?.[rowIndex]}
          table={table}
          window={window}
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

export interface SkeletonRowsProps {
  table: Table<any, any>
  leafColumns: Column<any, any, unknown>[]
  virtualColumns: VirtualItem[]
  rowCount: number
  /** Номер первой строки в теле: чётность полос продолжает тело. */
  firstRowIndex: number
  className?: string
  /** `false` — хвост вне области прокрутки: только его высота, как у тела вне окна. */
  cells?: boolean
  /** Пустые рамки строк без полосок: строки отказавшего блока (ADR 0138, §11). */
  empty?: boolean
  /** Атрибуты и стиль ячейки колонки: выделение незагруженной строки (ADR 0146, §3). */
  cellExtra?: (columnId: string) => SkeletonCellExtra | undefined
  /** Отступ и линии дерева строк — скелет-строка ленивых детей (ADR 0155, §3). */
  tree?: SkeletonTreeRow[]
  window?: WindowRow
}

export interface SkeletonCellExtra {
  attrs: Record<string, unknown>
  style: CSSProperties
}

/**
 * Строки скелета после тела (хвост догрузки, ADR 0081): колонки, ширины и
 * закрепление — как у тела. Скрыты от вспомогательных технологий и неинтерактивны.
 */
export const SkeletonRows = memo(
  ({
    table,
    leafColumns,
    virtualColumns,
    rowCount,
    firstRowIndex,
    className,
    cells = true,
    empty = false,
    cellExtra,
    tree,
    window,
  }: SkeletonRowsProps) => {
    const columns = getSkeletonColumns(
      table,
      leafColumns,
      virtualColumns,
      () => !empty,
      false,
    )
    return (
      <div
        aria-hidden="true"
        {...inertProp(true)}
        style={{ display: 'contents' }}
      >
        <SkeletonRowsBlock
          columns={
            cellExtra
              ? columns.map(column => {
                  const extra = cellExtra(column.id)
                  return extra
                    ? {
                        ...column,
                        attrs: { ...column.attrs, ...extra.attrs },
                        style: { ...column.style, ...extra.style },
                      }
                    : column
                })
              : columns
          }
          cellsVirtual
          filler={null}
          rowCount={rowCount}
          firstRowIndex={firstRowIndex}
          className={className}
          cells={cells}
          tree={tree}
          table={table}
          window={window}
          rowClassName={
            empty
              ? 'data-grid__body-row--empty'
              : 'data-grid__body-row--skeleton'
          }
        />
      </div>
    )
  },
)
SkeletonRows.displayName = 'SkeletonRows'

interface SkeletonBodyProps {
  table: Table<any, any>
  leafColumns: Column<any, any, unknown>[]
  virtualColumns: VirtualItem[]
}

/** Высота строки из темы грида; без темы — оценка виртуализатора. */
const readRowHeight = (node: HTMLElement) =>
  Number.parseFloat(
    getComputedStyle(node).getPropertyValue('--tsr-comp-row-height'),
  ) || ESTIMATE_SIZE

export const SkeletonBody = memo(
  ({ table, leafColumns, virtualColumns }: SkeletonBodyProps) => {
    const rootRef = useRef<HTMLDivElement>(null)
    const { options } = table
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

    // Строки разной высоты — скелет высотой оценки (ADR 0218, §8).
    const estimate = estimatedRowHeightOf(table)
    const rowCount = space
      ? getSkeletonRowCount({
          rowsCount,
          bodyHeight: space.body,
          rowHeight: estimate ?? space.row,
          pageSize,
        })
      : 0

    const hasColumns = leafColumns.length > 0
    const treeRows =
      tree && hasColumns ? getSkeletonTreeRows(rowCount) : undefined
    const columns = hasColumns
      ? getSkeletonColumns(table, leafColumns, virtualColumns, () => true)
      : Array.from({ length: columnsCount }, (_, index): SkeletonColumn => ({
          id: getSkeletonColumnId(index),
          placement: 'flow',
          flex: undefined,
          isActionsColumn: false,
          isIndent: false,
          isToggle: false,
          content: renderSkeletonCell(getSkeletonColumnId(index), 'bar', true),
          style: { flex: 1, minWidth: 0 },
          attrs: {},
        }))
    const cellsVirtual = hasColumns
    const bodyFiller = null

    const footerGroup = options.enableFooter
      ? table.getFooterGroups().at(0)
      : undefined
    const footerColumns =
      footerGroup && hasColumns
        ? getSkeletonColumns(
            table,
            leafColumns,
            virtualColumns,
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
          columns={columns}
          cellsVirtual={cellsVirtual}
          filler={bodyFiller}
          rowCount={rowCount}
          tree={treeRows}
          table={table}
          scatterToggles={!treeRows}
          rowHeight={estimate}
        />
        {footerColumns && (
          <div
            className={clsx('data-grid__footer--skeleton', footerStyles.footer)}
            data-position={getFooterPosition(table)}
            data-skeleton=""
          >
            <div style={{ display: 'contents' }}>
              <SkeletonCells
                columns={footerColumns}
                windowed={cellsVirtual}
                className="data-grid__footer-cell--skeleton"
                moduleClassName={footerCellStyles.footer__cell}
                table={table}
              />
            </div>
          </div>
        )}
      </div>
    )
  },
)

SkeletonBody.displayName = 'SkeletonBody'
