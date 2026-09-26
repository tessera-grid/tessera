// FooterCell: ячейка футера (footer через flexRender).
import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import { getDisplayColumnIndex } from '../core/displayColumns'
import {
  NAV_CELL_ATTR,
  useKeyboardNavigationCell,
} from '../core/keyboardNavigation'
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
  const table = header.getContext().table
  // Футер — строка навигации сразу после последней строки тела.
  const nav = useKeyboardNavigationCell(
    table,
    table.getRowModel().rows.length,
    header.column.id,
    !header.isPlaceholder,
  )

  return (
    <div
      key={header.id}
      ref={nav?.ref}
      tabIndex={nav?.tabIndex}
      onFocus={nav?.onFocus}
      onBlur={nav?.onBlur}
      {...(nav && { [NAV_CELL_ATTR]: '' })}
      data-kn-active={nav?.isActive || undefined}
      role={nav ? 'gridcell' : 'cell'}
      className={clsx('data-grid__footer-cell', styles.footer__cell)}
      style={{
        width: `var(${getHeaderSizeVariable(header.id)})`,
        ...(absoluteLeft !== undefined ? { left: absoluteLeft } : null),
      }}
      data-virtual-cell={absoluteLeft !== undefined || undefined}
      aria-colindex={getDisplayColumnIndex(table, header.column.id) + 1}
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
