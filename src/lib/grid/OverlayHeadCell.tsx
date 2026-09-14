// Cutover (grid) — v9-порт OverlayHeadCell: ячейка заголовка в DragOverlay при
// перетаскивании колонки. Контент через flexRender (самописный header.render убран).
import { type CSSProperties, memo, useMemo } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import {
  CellWrapperContent,
  getAlignContent,
} from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Header } from '../types'
import type { RegisterSlotParams } from '../core/createSlots'
import { RenderSlot } from '../core/renderSlots'
import { getHeaderSizeVariable } from './columnSizes'

import styles from '../grid/HeadCell/OverlayHeadCell.module.css'

interface OverlayHeadCellProps {
  header: Header<any, any, unknown>
  leftHeaderSlot?: RegisterSlotParams<any>[]
  rightHeaderSlot?: RegisterSlotParams<any>[]
}

export const OverlayHeadCell = memo(
  ({ header, leftHeaderSlot, rightHeaderSlot }: OverlayHeadCellProps) => {
    const cellStyles: CSSProperties = useMemo(
      () => ({
        width: `var(${getHeaderSizeVariable(header.column.id)})`,
      }),
      [header.column.id],
    )

    const enableResizingColumn = header.column.columnDef.enableResizing || false

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
      <div
        className={clsx(
          'data-grid-head__cell--overlay',
          styles['head__cell--overlay'],
        )}
        data-index={header.index}
        style={cellStyles}
        role="columnheader"
        data-column-resizable={enableResizingColumn}
        data-actions-column-cell={isActionsColumn}
      >
        <CellWrapperContent
          flex={getAlignContent({ isActionsColumn, isRowActionsColumn: false })}
        >
          <RenderSlot slot={leftHeaderSlot} context={header.getContext()} />
          {render}
          <RenderSlot slot={rightHeaderSlot} context={header.getContext()} />
        </CellWrapperContent>
      </div>
    )
  },
)

OverlayHeadCell.displayName = 'OverlayHeadCell'
