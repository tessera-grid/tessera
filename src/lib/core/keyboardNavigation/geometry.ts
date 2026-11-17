/** Геометрия: видимая область тела и довод активной ячейки в вид. */
import { hasRowSizes } from '../rowSizes'
import { viewportOf } from '../scrollToRow/viewport'
import { scrollLayer } from '../scrollStretch'
import {
  BODY_ROW_SELECTOR,
  FALLBACK_ROW_HEIGHT,
  FOOTER_SELECTOR,
  HEAD_SELECTOR,
  STICKY_ROWS_SELECTOR,
} from './model'

/**
 * Видимая по вертикали часть тела: между низом sticky-шапки и верхом закреплённого
 * футера; незакреплённый футер — строка в потоке и тело не закрывает (ADR 0118).
 */
export const getBodyViewport = (scroller: HTMLElement) => {
  const clientTop = scroller.getBoundingClientRect().top + scroller.clientTop
  const clientBottom = clientTop + scroller.clientHeight
  const head = scroller.querySelector(HEAD_SELECTOR)
  const footer = scroller.querySelector(
    `${FOOTER_SELECTOR}:not([data-position='inline'])`,
  )
  return {
    top: head
      ? Math.max(clientTop, head.getBoundingClientRect().bottom)
      : clientTop,
    bottom: footer
      ? Math.min(clientBottom, footer.getBoundingClientRect().top)
      : clientBottom,
  }
}

/** Видимая по горизонтали часть: между закреплёнными ячейками строки `cell`. */
export const getCenterViewport = (cell: HTMLElement, scroller: HTMLElement) => {
  const clientLeft = scroller.getBoundingClientRect().left + scroller.clientLeft
  let left = clientLeft
  let right = clientLeft + scroller.clientWidth
  const row = cell.closest('[role="row"]') ?? cell.parentElement
  row
    ?.querySelectorAll<HTMLElement>('[data-cell-pinned="left"]')
    .forEach(pinned => {
      left = Math.max(left, pinned.getBoundingClientRect().right)
    })
  row
    ?.querySelectorAll<HTMLElement>('[data-cell-pinned="right"]')
    .forEach(pinned => {
      right = Math.min(right, pinned.getBoundingClientRect().left)
    })
  return { left, right }
}

/**
 * Место строки ячейки на экране. Строку далеко за экраном растянутая область ставит не
 * дальше нескольких экранов (ADR 0142): её место — от видимой строки и разницы индексов,
 * высота строк одна (ADR 0077).
 */
/** Строка тела с индексом — загруженная или скелет незагруженной. */
const INDEXED_ROW = '[role="row"][data-index]'

const rowSpanOf = (cell: HTMLElement, scroller: HTMLElement, rect: DOMRect) => {
  const row = cell.closest<HTMLElement>(INDEXED_ROW)
  if (!row || !scrollLayer(scroller).stretched) return rect
  const view = scroller.getBoundingClientRect()
  const reference = [
    ...scroller.querySelectorAll<HTMLElement>(INDEXED_ROW),
  ].find(candidate => {
    const box = candidate.getBoundingClientRect()
    return box.bottom > view.top && box.top < view.bottom
  })
  if (!reference || reference === row) return rect
  const base = reference.getBoundingClientRect()
  const offset =
    (Number(row.dataset.index) - Number(reference.dataset.index)) * base.height
  return { top: base.top + offset, bottom: base.bottom + offset }
}

/**
 * Довести ячейку в видимую область с учётом sticky-шапки/футера и закреплённых
 * колонок (виртуализатор о них не знает). Ячейки заголовка — только по горизонтали,
 * закреплённые — только по вертикали.
 */
export const ensureCellVisible = (
  cell: HTMLElement,
  scroller: HTMLElement,
  isSticky: boolean,
) => {
  const rect = cell.getBoundingClientRect()
  if (!isSticky) {
    const viewport = getBodyViewport(scroller)
    const { bottom } = viewport
    // Стопка липких строк закрывает верх тела: ячейка встаёт под неё (ADR 0232, KX6).
    const top = [...scroller.querySelectorAll(STICKY_ROWS_SELECTOR)].reduce(
      (edge, row) => Math.max(edge, row.getBoundingClientRect().bottom),
      viewport.top,
    )
    const span = rowSpanOf(cell, scroller, rect)
    // Строка выше видимой области встаёт верхом к краю (ADR 0218, §7).
    if (span.top < top || span.bottom - span.top > bottom - top) {
      scrollLayer(scroller).scrollBy(span.top - top)
    } else if (span.bottom > bottom) {
      scrollLayer(scroller).scrollBy(span.bottom - bottom)
    }
  }
  const pinned = cell.getAttribute('data-cell-pinned')
  if (pinned !== 'left' && pinned !== 'right') {
    const { left, right } = getCenterViewport(cell, scroller)
    if (rect.left < left) {
      scroller.scrollLeft -= left - rect.left
    } else if (rect.right > right) {
      scroller.scrollLeft += rect.right - right
    }
  }
}

/**
 * Строк до места на видимую высоту от строки `rowIndex` в сторону `direction`: при строках
 * разной высоты — по местам строк у виртуализатора, а не по высоте одной строки (ADR 0218, §7).
 */
export const getPageRows = (
  scroller: HTMLElement | null,
  page?: { table: unknown; rowIndex: number; direction: 1 | -1 },
): number => {
  if (!scroller) {
    return 1
  }
  const { top, bottom } = getBodyViewport(scroller)
  const rows = page && viewportOf(page.table)?.rows
  if (page && rows && hasRowSizes(page.table)) {
    const from = rows.measurementsCache[page.rowIndex]
    const target = from
      ? rows.getVirtualItemForOffset(
          from.start + page.direction * (bottom - top),
        )
      : undefined
    if (target) return Math.max(1, Math.abs(target.index - page.rowIndex))
  }
  const rowHeight =
    scroller.querySelector(BODY_ROW_SELECTOR)?.getBoundingClientRect().height ||
    FALLBACK_ROW_HEIGHT
  return Math.max(1, Math.floor((bottom - top) / rowHeight))
}
