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
import { rowSourceOf } from '../core/rowSource'
import type { Header } from '../types'
import { getCellPinningParams, pinnedSideToDom } from './cellPinningParams'
import { getHeaderSizeVariable, getVirtualCellLeft } from './columnSizes'
import { highlightRender, useColumnHighlight } from './highlight'
import { flashRender, useColumnFlash } from './flash'

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
    table.getRowSource().count(),
    header.column.id,
    !header.isPlaceholder,
  )
  const pinning = getCellPinningParams(table as never, header.column as never)
  // Подсветка колонки (ADR 0080); описание несёт заголовок.
  const columnHighlight = useColumnHighlight(table, header.column.id)
  const highlighted = highlightRender([
    { layer: 'column', state: columnHighlight, describe: false },
  ])
  // Итог колонки серверной выборки (ADR 0144, §4): без своего `footer` — его значение.
  const total = rowSourceOf(table).totals?.()?.[header.column.id]
  const { footer } = header.column.columnDef
  const flashed = flashRender([
    { layer: 'column', entry: useColumnFlash(table, header.column.id) },
  ])

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
        // Как в теле: виртуальная центральная — по `left`, закреплённая — sticky-офсеты.
        ...(absoluteLeft !== undefined
          ? { left: getVirtualCellLeft(header.column.id, absoluteLeft) }
          : {
              minWidth: `var(${getHeaderSizeVariable(header.id)})`,
              left: pinning.startPinnedOffset,
              right: pinning.endPinnedOffset,
            }),
        ...highlighted.style,
        ...flashed.style,
      }}
      {...highlighted.attrs}
      {...flashed.attrs}
      data-virtual-cell={absoluteLeft !== undefined || undefined}
      aria-colindex={getDisplayColumnIndex(table, header.column.id) + 1}
      data-column-id={header.column.id}
      data-cell-pinned={pinnedSideToDom(header.column.getIsPinned())}
      data-cell-last-left-pinned={pinning.isLastStartPinnedColumn}
      data-cell-first-right-pinned={pinning.isFirstEndPinnedColumn}
      data-actions-column-cell={header.column.getIsActionsColumn()}
      data-layout={layout}
      data-first-cell-in-row={header.column.getIsFirstColumn()}
      data-last-cell-in-row={header.column.getIsLastColumn()}
    >
      <CellWrapperContent>
        <CellWrapperTitle>
          {header.isPlaceholder
            ? null
            : footer !== undefined
              ? flexRender(footer, header.getContext())
              : total === undefined || total === null
                ? null
                : String(total)}
        </CellWrapperTitle>
      </CellWrapperContent>
    </div>
  )
}
