/** Геометрия: видимая область тела и довод активной ячейки в вид. */
import {
  BODY_ROW_SELECTOR,
  FALLBACK_ROW_HEIGHT,
  FOOTER_SELECTOR,
  HEAD_SELECTOR,
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
    const { top, bottom } = getBodyViewport(scroller)
    if (rect.top < top) {
      scroller.scrollTop -= top - rect.top
    } else if (rect.bottom > bottom) {
      scroller.scrollTop += rect.bottom - bottom
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

export const getPageRows = (scroller: HTMLElement | null): number => {
  if (!scroller) {
    return 1
  }
  const { top, bottom } = getBodyViewport(scroller)
  const rowHeight =
    scroller.querySelector(BODY_ROW_SELECTOR)?.getBoundingClientRect().height ||
    FALLBACK_ROW_HEIGHT
  return Math.max(1, Math.floor((bottom - top) / rowHeight))
}
