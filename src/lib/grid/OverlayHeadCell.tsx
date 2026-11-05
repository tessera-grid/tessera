// OverlayHeadCell: призрак колонки в DragOverlay — облачко кита `DragCloud` (ADR 0183, PK21).
// Контент через flexRender, кнопки — та же ActionsZone, что у ячейки заголовка;
// ширина — переменная заголовка (у группы — по header.id).
import { type CSSProperties, memo, useMemo } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent, getAlignContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Header } from '../types'
import type { RegisterSlotParams } from '../core/createSlots'
import { getHeaderSizeVariable } from './columnSizes'
import { ActionsZone } from './headerActions/ActionsZone'
import { DragCloud } from '../ui/DragCloud/DragCloud'

import styles from '../grid/HeadCell/OverlayHeadCell.module.css'
import { inertProp } from '../core/inertProp'

interface OverlayHeadCellProps {
  header: Header<any, any, unknown>
  leftHeaderSlot?: RegisterSlotParams<any>[]
  rightHeaderSlot?: RegisterSlotParams<any>[]
}

export const OverlayHeadCell = memo(
  ({ header, leftHeaderSlot, rightHeaderSlot }: OverlayHeadCellProps) => {
    const cellStyles: CSSProperties = useMemo(
      () => ({
        width: `var(${getHeaderSizeVariable(header.id)})`,
      }),
      [header.id],
    )

    const enableResizingColumn = header.column.getCanResize?.() ?? false

    const isActionsColumn = header.column.getIsActionsColumn()

    const render = useMemo(
      () => (
        <CellWrapperTitle>
          {flexRender(header.column.columnDef.header, header.getContext())}
        </CellWrapperTitle>
      ),
      [header],
    )

    return (
      <DragCloud
        kind="column"
        className={clsx(
          'data-grid-head__cell--overlay',
          styles['head__cell--overlay'],
        )}
        data-index={header.index}
        style={cellStyles}
        // Призрак — визуальный клон: ни в дереве доступности, ни в фокусе (ADR 0052, ND13).
        {...inertProp(true)}
        data-column-resizable={enableResizingColumn}
        data-actions-column-cell={isActionsColumn}
      >
        <CellWrapperContent
          flex={getAlignContent({ isActionsColumn, isFillColumn: false })}
        >
          {!isActionsColumn && (
            <ActionsZone
              slot="leftHeaderSlot"
              opaqueSlot={leftHeaderSlot}
              context={header.getContext()}
            />
          )}
          {render}
          {!isActionsColumn && (
            <ActionsZone
              slot="rightHeaderSlot"
              opaqueSlot={rightHeaderSlot}
              context={header.getContext()}
            />
          )}
        </CellWrapperContent>
      </DragCloud>
    )
  },
)

OverlayHeadCell.displayName = 'OverlayHeadCell'
