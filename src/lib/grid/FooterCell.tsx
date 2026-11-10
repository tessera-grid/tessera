// FooterCell: ячейка футера (footer через flexRender).
import { memo } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import { formatDataTypeValue } from '../core/dataTypeFormat'
import { getDisplayColumnIndex } from '../core/displayColumns'
import {
  NAV_CELL_ATTR,
  useKeyboardNavigationCell,
} from '../core/keyboardNavigation'
import type { Header } from '../types'
import { getCellPinningParams, pinnedSideToDom } from './cellPinningParams'
import { getHeaderSizeVariable, getVirtualCellLeft } from './columnSizes'
import { highlightRender, useColumnHighlight } from './highlight'
import { flashRender, useColumnFlash } from './flash'

import styles from '../grid/FooterCell/FooterCell.module.css'

export interface FooterCellProps {
  header: Header<any, any, unknown>
  // Абсолютная позиция центральной виртуализированной ячейки футера (симметрично телу).
  absoluteLeft?: number
  /** Строки и состояние таблицы — ключи перерисовки мемо, ячейка их не читает. */
  rows?: unknown
  state?: unknown
}

/** Итог текстом: массив (`extent`, `unique`) — через запятую, объект читает свой `footer`. */
const totalText = (
  table: Parameters<typeof formatDataTypeValue>[0],
  column: Parameters<typeof formatDataTypeValue>[1],
  total: unknown,
) => {
  const text = (value: unknown) =>
    formatDataTypeValue(table, column, value, undefined)
  if (total === undefined || total === null) return null
  if (Array.isArray(total)) return total.map(text).join(', ')
  return typeof total === 'object' && !(total instanceof Date)
    ? null
    : text(total)
}

// Мемо: сдвиг окна колонок перерисовывает футер, но не его прежние ячейки (ADR 0149, PS13).
export const FooterCell = memo(({ header, absoluteLeft }: FooterCellProps) => {
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
  // Итог колонки (ADR 0184, §4): без своего `footer` — текст по типу колонки, как в её
  // ячейке (GS14).
  const total = table.getColumnTotal(header.column.id)
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
      data-first-cell-in-row={header.column.getIsFirstColumn()}
      data-last-cell-in-row={header.column.getIsLastColumn()}
    >
      <CellWrapperContent>
        <CellWrapperTitle>
          {header.isPlaceholder
            ? null
            : footer !== undefined
              ? flexRender(footer, header.getContext())
              : totalText(table, header.column, total)}
        </CellWrapperTitle>
      </CellWrapperContent>
    </div>
  )
})

FooterCell.displayName = 'FooterCell'
