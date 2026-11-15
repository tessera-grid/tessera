// FooterCell: ячейка футера (footer через flexRender).
import { memo, useRef } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import { formatAggregateValue } from '../core/dataTypeFormat'
import { getDisplayColumnIndex } from '../core/displayColumns'
import {
  NAV_CELL_ATTR,
  useKeyboardNavigationCell,
} from '../core/keyboardNavigation'
import type { Header } from '../types'
import { getCellPinningParams, pinnedSideToDom } from './cellPinningParams'
import { getHeaderSizeVariable, getVirtualCellLeft } from './columnSizes'
import { highlightRender, useColumnHighlight } from './highlight'
import {
  directionOf,
  flashRender,
  useColumnFlash,
  useFooterFlash,
} from './flash'
import { assignRef } from '../ui/assignRef'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'

import styles from '../grid/FooterCell/FooterCell.module.css'

export interface FooterCellProps {
  header: Header<any, any, unknown>
  // Абсолютная позиция центральной виртуализированной ячейки футера (симметрично телу).
  absoluteLeft?: number
  /** Строки и состояние таблицы — ключи перерисовки мемо, ячейка их не читает. */
  rows?: unknown
  state?: unknown
  /** Функция итога таблицы — ключ перерисовки: новые итоги приложения (ADR 0229). */
  totalOf?: unknown
}

/** Итог текстом: массив (`extent`, `unique`) — через запятую, объект читает свой `footer`. */
const totalText = (
  table: Parameters<typeof formatAggregateValue>[0],
  column: Parameters<typeof formatAggregateValue>[1],
  total: unknown,
) => {
  // Счётная функция — целое число по языку таблицы, а не по типу колонки (ADR 0230, §5).
  const text = (value: unknown) =>
    formatAggregateValue(table, column, value, undefined)
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
  const totalFlash = useFooterFlash(table, header.column.id)
  const flashed = flashRender([
    { layer: 'cell', entry: totalFlash },
    { layer: 'column', entry: useColumnFlash(table, header.column.id) },
  ])
  // Рост и падение итога — ещё и стрелкой, как у ячейки (ADR 0221, §9).
  const direction = directionOf(totalFlash)
  const text = header.isPlaceholder
    ? null
    : footer !== undefined
      ? flexRender(footer, header.getContext())
      : totalText(table, header.column, total)
  // Имя функции перед числом (ADR 0230, §4): только у итога без своего `footer`.
  const label =
    footer === undefined && text
      ? table.options.columnTotalLabel?.(table, header.column.id)
      : undefined

  // Сторож итога (ADR 0221, §9): при монтировании и при смене итога.
  const cellRef = useRef<HTMLDivElement | null>(null)
  const seen = useRef<{ total: unknown } | undefined>(undefined)
  const watchTotal = table.options.watchColumnTotal
  const columnId = header.column.id
  useIsomorphicLayoutEffect(() => {
    if (!watchTotal || header.isPlaceholder) return
    const previous = seen.current
    if (previous && Object.is(previous.total, total)) return
    seen.current = { total }
    watchTotal({
      table,
      columnId,
      total,
      previous: previous?.total,
      mounted: !previous,
      element: cellRef.current,
    })
  }, [watchTotal, total, table, columnId, header.isPlaceholder])

  return (
    <div
      key={header.id}
      ref={element => {
        cellRef.current = element
        assignRef(nav?.ref, element)
      }}
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
      {direction && (
        <span
          aria-hidden
          className={styles['flash-direction']}
          data-flash-direction={direction.outcome}
          data-out={direction.out}
        />
      )}
      <CellWrapperContent>
        <CellWrapperTitle>
          {label ? (
            // Подпись сокращается первой, число видно целиком (SU7).
            <span className={styles['footer__total']}>
              <span
                className={styles['footer__total-label']}
                data-total-label=""
              >
                {label}
              </span>
              <span className={styles['footer__total-value']}>{text}</span>
            </span>
          ) : (
            text
          )}
        </CellWrapperTitle>
      </CellWrapperContent>
    </div>
  )
})

FooterCell.displayName = 'FooterCell'
