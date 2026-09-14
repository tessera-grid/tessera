// Cutover (grid) — v9-порт Footer: контейнер футера (rowgroup→row→cell), с той же
// логикой column-виртуализации, что Head/Body. Мемоизация активна только при ресайзе.
import { memo } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'

import type { HeaderGroup } from '../types'
import { FooterCell } from './FooterCell'
import { LeftEmptyColumn, RightEmptyColumn } from './VirtualizePaddingColumns'
import { RightFillerBodyColumn } from './RightFillerBodyColumn'

import footerStyles from '../grid/Footer/Footer.module.css'

export interface FooterProps {
  layout: 'grid' | 'flex'
  footerGroup?: HeaderGroup<any, any>
  virtualColumns: VirtualItem[]
  isVirtualColumns: boolean
  isResizingColumns: false | string
}

export const Footer = ({
  layout,
  footerGroup,
  virtualColumns,
  isVirtualColumns,
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

MemoizedFooter.displayName = 'MemoizedFooter'
