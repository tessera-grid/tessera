// FooterCell: ячейка футера (footer через flexRender).
import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import { getDisplayColumnIndex } from '../core/displayColumns'
import type { Header } from '../types'
import { getHeaderSizeVariable } from './columnSizes'

import styles from '../grid/FooterCell/FooterCell.module.css'

export interface FooterCellProps {
  layout: 'grid' | 'flex'
  header: Header<any, any, unknown>
  // Абсолютная позиция центральной виртуализированной ячейки футера (симметрично телу).
  absoluteLeft?: number
}

export const FooterCell = ({
  layout,
  header,
  absoluteLeft,
}: FooterCellProps) => {
  return (
    <div
      key={header.id}
      role="cell"
      className={clsx('data-grid__footer-cell', styles.footer__cell)}
      style={{
        width: `var(${getHeaderSizeVariable(header.id)})`,
        ...(absoluteLeft !== undefined ? { left: absoluteLeft } : null),
      }}
      data-virtual-cell={absoluteLeft !== undefined || undefined}
      aria-colindex={
        getDisplayColumnIndex(header.getContext().table, header.column.id) + 1
      }
      data-column-id={header.column.id}
      data-layout={layout}
      data-first-cell-in-row={header.column.getIsFirstColumn()}
      data-last-cell-in-row={header.column.getIsLastColumn()}
    >
      <CellWrapperContent>
        <CellWrapperTitle>
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.footer, header.getContext())}
        </CellWrapperTitle>
      </CellWrapperContent>
    </div>
  )
}
