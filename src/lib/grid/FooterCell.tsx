// Cutover (grid) — v9-порт FooterCell: ячейка футера (footer через flexRender).
import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Header } from '../types'
import { getHeaderSizeVariable } from './columnSizes'

import styles from '../grid/FooterCell/FooterCell.module.css'

export interface FooterCellProps {
  layout: 'grid' | 'flex'
  header: Header<any, any, unknown>
  // Абсолютная позиция центральной виртуализированной ячейки футера (симметрично телу).
  absoluteLeft?: number
}

export const FooterCell = ({ layout, header, absoluteLeft }: FooterCellProps) => {
  return (
    <div
      key={header.id}
      role="cell"
      className={clsx('data-grid__footer-cell', styles.footer__cell)}
      style={{
        width: `var(${getHeaderSizeVariable(header.id)})`,
        ...(absoluteLeft !== undefined
          ? { position: 'absolute', left: absoluteLeft, top: 0, height: '100%' }
          : null),
      }}
      aria-colindex={header.column.getIndex() + 1}
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
