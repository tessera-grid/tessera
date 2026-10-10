// Footer: контейнер футера (rowgroup→row→cell), с той же логикой
// column-виртуализации, что Head/Body. Мемоизация активна только при ресайзе.
import { memo } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { Header, HeaderGroup } from '../types'
import { FooterCell } from './FooterCell'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'
import { RightFillerBodyColumn } from './RightFillerBodyColumn'
import { needsRightFiller } from './layout'

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
    <div
      role="rowgroup"
      className={clsx('data-grid__footer', footerStyles.footer)}
      data-layout={layout}
    >
      {/* Строка — свой бокс, а не display: contents: такую строку Safari до 17 убирает
          из дерева доступности (ADR 0084). */}
      <div role="row" className={footerStyles.footer__row}>
        {isVirtualColumns ? (
          (() => {
            // Симметрично Head/Body: пиннутые — в потоке, центральные — position:absolute
            // по своему `left` (вне потока), между ними спейсер постоянной ширины.
            const startH: Header<any, any, unknown>[] = []
            const endH: Header<any, any, unknown>[] = []
            const centerH: {
              header: Header<any, any, unknown>
              start: number
            }[] = []
            for (const virtualColumn of virtualColumns) {
              const header = headers[virtualColumn.index]
              const pinned = header.column.getIsPinned()
              if (pinned === 'start') startH.push(header)
              else if (pinned === 'end') endH.push(header)
              else centerH.push({ header, start: virtualColumn.start })
            }
            return (
              <>
                {startH.map(h => (
                  <FooterCell key={h.id} layout={layout} header={h} />
                ))}
                <VirtualCenterSpacer />
                {centerH.map(({ header, start }) => (
                  <FooterCell
                    key={header.id}
                    layout={layout}
                    header={header}
                    absoluteLeft={start}
                  />
                ))}
                {endH.map(h => (
                  <FooterCell key={h.id} layout={layout} header={h} />
                ))}
              </>
            )
          })()
        ) : (
          <>
            {headers.map(header => (
              <FooterCell key={header.id} layout={layout} header={header} />
            ))}
            {needsRightFiller(headers.at(-1)?.column) && (
              <RightFillerBodyColumn
                hasBorderBottom={layout === 'grid'}
                hasBorderRight={layout === 'grid'}
              />
            )}
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
