import { CSSProperties, memo, useMemo } from 'react'

import { Header, HeaderContext, flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { getHeaderSizeVariable } from '../../core/createColumns/calculateColumnSizes'
import { RegisterSlotParams } from '../../core/createSlots'
import { RenderSlot } from '../../core/renderSlots'
import { CellWrapperContent, getAlignContent } from '../CellWrapperContent'
import { CellWrapperTitle } from '../CellWrapperTitle'

import styles from './OverlayHeadCell.module.css'

interface OverlayHeadCellProps {
  header: Header
  leftHeaderSlot?: RegisterSlotParams<HeaderContext>[]
  rightHeaderSlot?: RegisterSlotParams<HeaderContext>[]
}

/**
 * @description
 */
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
          {flexRender(
            header.render || header.column.columnDef.header,
            header.getContext(),
          )}
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
