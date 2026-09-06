import { Header, flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { getHeaderSizeVariable } from '../../core/createColumns/calculateColumnSizes'
import { CellWrapperContent } from '../CellWrapperContent'
import { CellWrapperTitle } from '../CellWrapperTitle'

import styles from './FooterCell.module.css'

export interface FooterCellProps {
  layout: 'grid' | 'flex'

  header: Header
}

export const FooterCell = ({ layout, header }: FooterCellProps) => {
  return (
    <div
      key={header.id}
      role="cell"
      className={clsx('data-grid__footer-cell', styles.footer__cell)}
      style={{
        width: `var(${getHeaderSizeVariable(header.id)})`,
        willChange: 'width',
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
