// Footer: контейнер футера (rowgroup→row→cell), с той же логикой
// column-виртуализации, что Head/Body. Мемоизация активна только при ресайзе.
import { memo } from 'react'

import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'
import clsx from 'clsx'

import type { FooterPosition } from '../core/footer'
import type { Header, HeaderGroup } from '../types'
import { FooterCell } from './FooterCell'
import { rowsGetterOf } from './rowsGetter'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'
import { RightFillerBodyColumn } from './RightFillerBodyColumn'
import { needsRightFiller } from './layout'

import footerStyles from '../grid/Footer/Footer.module.css'

export interface FooterProps {
  layout: 'grid' | 'flex'
  position: FooterPosition
  footerGroup?: HeaderGroup<any, any>
  virtualColumns: VirtualItem[]
  isVirtualColumns: boolean
  isResizingColumns: false | string
}

export const Footer = ({
  layout,
  position,
  footerGroup,
  virtualColumns,
  isVirtualColumns,
}: FooterProps) => {
  if (!footerGroup) {
    return null
  }

  const { headers } = footerGroup
  // Подпись футера читает строки и состояние таблицы: ячейка перерисовывается при их смене,
  // а не при сдвиге окна колонок (ADR 0149, PS13).
  const table = headers[0]?.getContext().table
  const rows = table?.getRowSource().rows?.()
  // Ключ — геттер: dev-журнал React обошёл бы массив строк в пропсах (ADR 0199, MS12).
  const rowsKey = rowsGetterOf(rows)
  const state = table?.store.get()

  return (
    <div
      role="rowgroup"
      className={clsx('data-grid__footer', footerStyles.footer)}
      data-layout={layout}
      data-position={position}
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
            // Один массив с ключами: при закреплении ячейка переезжает, а не монтируется заново.
            return (
              <>
                <VirtualCenterSpacer />
                {[
                  ...startH.map(h => (
                    <FooterCell
                      key={h.id}
                      layout={layout}
                      header={h}
                      rows={rowsKey}
                      state={state}
                    />
                  )),
                  ...centerH.map(({ header, start }) => (
                    <FooterCell
                      key={header.id}
                      layout={layout}
                      header={header}
                      absoluteLeft={start}
                      rows={rowsKey}
                      state={state}
                    />
                  )),
                  ...endH.map(h => (
                    <FooterCell
                      key={h.id}
                      layout={layout}
                      header={h}
                      rows={rowsKey}
                      state={state}
                    />
                  )),
                ]}
              </>
            )
          })()
        ) : (
          <>
            {headers.map(header => (
              <FooterCell
                key={header.id}
                layout={layout}
                header={header}
                rows={rowsKey}
                state={state}
              />
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
