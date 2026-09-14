// Cutover (grid) — v9-порт BodyCell. Ячейка тела: пиннинг-стили/атрибуты (start/end),
// skeleton при fast-scroll, слоты, контент через нативный flexRender.
// Отличия от v8: самописный cell.renderComponent убран (контент рисует flexRender от
// columnDef.cell); пиннинг start/end через getCellPinningParams; переиспользуем
// v8-независимые CellWrapper/Skeleton/fastScroll. TODO(cutover): ветка
// rowActions-колонки (ActionsZone) портируется отдельно.
import { memo, useMemo } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { useFastScrollSuppressed } from '../core/fastScroll'
import { useTableState } from '../core/reactivity'
import {
  CellWrapperContent,
  getAlignContent,
} from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import { Skeleton } from '../ui/Skeleton'
import type { Cell } from '../types'
import { RenderSlot } from '../core/renderSlots'
import type { RegisterSlotParams } from '../core/createSlots'
import { ActionsZone } from './headerActions/ActionsZone'
import { getCellPinningParams, pinnedSideToDom } from './cellPinningParams'
import { getCellExpandingStyles } from './cellExpandingStyles'
import { getColumnSizeVariable } from './columnSizes'

import styles from '../grid/BodyCell/BodyCell.module.css'

interface TableBodyCellProps {
  layout: 'grid' | 'flex'
  cell: Cell<any, any, unknown>
  rowIndex: number
  leftCellSlot?: RegisterSlotParams<any>[]
  rightCellSlot?: RegisterSlotParams<any>[]
  actionRowSlot?: RegisterSlotParams<any>[]
  interact?: boolean
  // Абсолютная позиция центральной (непиннутой) виртуализированной ячейки: её `left`
  // от левого края строки. Ячейка выносится из потока (position:absolute), чтобы её
  // монтаж/демонтаж на границе окна не пере-раскладывал соседей. Для пиннутых и
  // невиртуализированных ячеек не задаётся (обычный поток/sticky).
  absoluteLeft?: number
}

export const BodyCell = memo(
  ({
    layout,
    cell,
    rowIndex,
    leftCellSlot,
    rightCellSlot,
    actionRowSlot,
    interact = true,
    absoluteLeft,
  }: TableBodyCellProps) => {
    const table = cell.getContext().table

    // Самоподписка: BodyCell — memo по стабильному `cell`, поэтому смена срезов не
    // приходит сверху новым пропом. Подписка сужена до срезов ФОРМЫ КОЛОНОК, от которых
    // зависят атрибуты/офсеты ячейки (пиннинг/размеры/порядок/видимость) — на смену
    // rowSelection/сортировки/раскрытия ячейка НЕ ре-рендерится (это лишняя работа;
    // контент-реактивность несут сам плагин-компонент ячейки и его useSelector).
    useTableState(table as never, (state: unknown) => {
      const s = state as Record<string, unknown>
      return {
        columnPinning: s.columnPinning,
        columnSizing: s.columnSizing,
        columnOrder: s.columnOrder,
        columnVisibility: s.columnVisibility,
      }
    })

    const {
      isStartPinned,
      isEndPinned,
      isLastStartPinnedColumn,
      isLastEndPinnedColumn,
      isFirstEndPinnedColumn,
      isAloneEndPinnedColumn,
      startPinnedOffset,
      endPinnedOffset,
    } = getCellPinningParams(table as never, cell.column as never)

    const { paddingLeft } = getCellExpandingStyles({
      column: cell.column as never,
      rowDepth: cell.row.depth,
      table: table as never,
    })

    const isPinnedColumn = cell.column.getIsPinned()
    const isActionsColumn = cell.column.getIsActionsColumn()
    const isRowActionsColumn = cell.column.getIsRowActionsColumn()

    const isSuppressed = useFastScrollSuppressed()
    const showSkeleton = isSuppressed && !isActionsColumn && !isPinnedColumn
    const canRenderSlots = !isActionsColumn && !showSkeleton

    const render = useMemo(() => {
      if (showSkeleton) {
        return <Skeleton width="50%" height={16} animation={false} />
      }
      if (isSuppressed) {
        return null
      }

      // Колонка действий строки — зона действий в слоте actionRowSlot (инлайн-кнопки
      // + overflow-кебаб), а не flexRender контента.
      if (isRowActionsColumn) {
        return (
          <ActionsZone
            slot="actionRowSlot"
            opaqueSlot={actionRowSlot}
            context={cell.getContext()}
          />
        )
      }

      const content = flexRender(cell.column.columnDef.cell, cell.getContext())

      // Сервисная колонка — контент без CellWrapperTitle.
      return isActionsColumn ? content : <CellWrapperTitle>{content}</CellWrapperTitle>
    }, [cell, isActionsColumn, isRowActionsColumn, actionRowSlot, isSuppressed, showSkeleton])

    return (
      <div
        role="cell"
        className={clsx('data-grid__body-cell', styles.body__cell)}
        style={{
          minWidth: `var(${getColumnSizeVariable(cell.column.id)})`,
          width: `var(${getColumnSizeVariable(cell.column.id)})`,
          ...(absoluteLeft !== undefined
            ? { position: 'absolute', left: absoluteLeft, top: 0, height: '100%' }
            : { left: startPinnedOffset, right: endPinnedOffset }),
          paddingLeft,
        }}
        aria-colindex={cell.column.getIndex() + 1}
        data-column-id={cell.column.id}
        data-cell-pinned={pinnedSideToDom(isPinnedColumn)}
        data-cell-odd-left-pinned={isStartPinned && rowIndex % 2 !== 0}
        data-cell-odd-right-pinned={isEndPinned && rowIndex % 2 !== 0}
        data-cell-last-left-pinned={isLastStartPinnedColumn}
        data-cell-last-right-pinned={isLastEndPinnedColumn}
        data-cell-first-right-pinned={isFirstEndPinnedColumn}
        data-cell-alone-right-pinned={isAloneEndPinnedColumn}
        data-actions-column-cell={isActionsColumn}
        data-cell-interact={interact}
        data-layout={layout}
        data-first-cell-in-row={cell.column.getIsFirstColumn()}
        data-last-cell-in-row={cell.column.getIsLastColumn()}
        data-cell-of-first-row={cell.row.getIsFirstRow()}
        data-cell-of-last-row={cell.row.getIsLastRow()}
      >
        <CellWrapperContent
          flex={getAlignContent({
            isActionsColumn,
            isRowActionsColumn: cell.column.getIsRowActionsColumn(),
          })}
          smallPadding={isActionsColumn}
        >
          {canRenderSlots && (
            <RenderSlot slot={leftCellSlot} context={cell.getContext()} />
          )}
          {render}
          {canRenderSlots && (
            <RenderSlot slot={rightCellSlot} context={cell.getContext()} />
          )}
        </CellWrapperContent>
      </div>
    )
  },
)

BodyCell.displayName = 'BodyCell'
