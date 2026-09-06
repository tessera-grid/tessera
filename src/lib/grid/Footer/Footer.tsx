import { memo } from 'react'

import { HeaderGroup } from '@tanstack/react-table'
import { VirtualItem } from '@tanstack/react-virtual'

import { RightFillerBodyColumn } from '../BodyRow/RightFillerBodyColumn'
import { FooterCell } from '../FooterCell/FooterCell'
import { LeftEmptyColumn, RightEmptyColumn } from '../VirtualizePaddingColumns'

import footerStyles from './Footer.module.css'

export interface FooterProps {
  layout: 'grid' | 'flex'
  footerGroup?: HeaderGroup<any>
  virtualColumns: VirtualItem[]
  isVirtualColumns: boolean
  isResizingColumns: false | string
}

export const Footer = ({
  layout,
  footerGroup,
  virtualColumns,
  isVirtualColumns,
  isResizingColumns: _isResizingColumns,
}: FooterProps) => {
  if (!footerGroup) {
    return null
  }

  const { headers } = footerGroup

  return (
    <div role="rowgroup" className={footerStyles.footer} data-layout={layout}>
      {/* display:contents — семантическая строка (rowgroup→row→cell) без
          собственного бокса, чтобы ячейки остались треками общей grid/flex-сетки. */}
      <div role="row" style={{ display: 'contents' }}>
        {isVirtualColumns ? (
          // Flat headers → column-virtualized: render only the visible window,
          // padded by empty spacer columns (mirrors Head / Body).
          <>
            <LeftEmptyColumn />
            {virtualColumns.map(virtualColumn => {
              const header = headers[virtualColumn.index]

              return (
                <FooterCell key={header.id} layout={layout} header={header} />
              )
            })}
            <RightEmptyColumn />
          </>
        ) : (
          // Nested headers → grid layout, column virtualization disabled: render
          // every footer cell.
          <>
            {headers.map(header => (
              <FooterCell key={header.id} layout={layout} header={header} />
            ))}
            <RightFillerBodyColumn
              hasBorderBottom={layout === 'grid'}
              hasBorderRight={layout === 'grid'}
            />
          </>
        )}
      </div>
    </div>
  )
}

export const MemoizedFooter = memo(
  Footer,
  (_, next) => next.isResizingColumns !== false,
)
