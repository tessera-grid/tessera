import { useEffect } from 'react'

import { logWarn, shouldLog, type LoggerHost } from './logger'

/** Ниже этого тело заведомо помещается и держит липкую шапку в любом браузере — мерить незачем. */
const SAFE_HEIGHT = 8_000_000

/** Атрибут пробника замера: значение — вид замера, `height` или `sticky`. */
export const LIMIT_PROBE_ATTRIBUTE = 'data-tsr-limit-probe'

let heightLimit: number | undefined
let stickyLimit: number | undefined

const createProbe = (kind: 'height' | 'sticky') => {
  const box = document.createElement('div')
  box.setAttribute(LIMIT_PROBE_ATTRIBUTE, kind)
  box.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:100px;overflow:hidden;visibility:hidden;pointer-events:none'
  document.body.append(box)
  return box
}

/**
 * Наибольшая высота элемента (ADR 0141, BH1): выше Chromium и WebKit её обрезают, а
 * Firefox даёт высоту 0 — тогда предел ищется бинарным поиском. Меряется один раз.
 */
export const measureScrollHeightLimit = (): number => {
  if (heightLimit !== undefined) return heightLimit
  const box = createProbe('height')
  const block = document.createElement('div')
  box.append(block)
  const heightOf = (px: number) => {
    block.style.height = `${px}px`
    return block.getBoundingClientRect().height
  }
  const clamped = heightOf(1e9)
  if (clamped > 0) {
    heightLimit = clamped
  } else {
    // На таких высотах Firefox округляет до пикселей: блок «получил» высоту — значит не 0.
    let fits = SAFE_HEIGHT
    let fails = 1e9
    while (fails - fits > 1) {
      const middle = Math.floor((fits + fails) / 2)
      if (heightOf(middle) > 0) fits = middle
      else fails = middle
    }
    heightLimit = fits
  }
  box.remove()
  return heightLimit
}

/**
 * Наибольшая прокрутка, на которой `sticky; top: 0` остаётся у верха области (BH2);
 * `Infinity` — предела нет. Меряется один раз.
 */
export const measureStickyScrollLimit = (): number => {
  if (stickyLimit !== undefined) return stickyLimit
  const height = Math.floor(measureScrollHeightLimit())
  const box = createProbe('sticky')
  box.style.overflow = 'scroll'
  const sticky = document.createElement('div')
  sticky.style.cssText = 'position:sticky;top:0;height:1px'
  const tall = document.createElement('div')
  tall.style.height = `${height - 1}px`
  box.append(sticky, tall)
  const top = box.getBoundingClientRect().top
  const holds = (scroll: number) => {
    box.scrollTop = scroll
    return Math.abs(sticky.getBoundingClientRect().top - top) < 1
  }
  const end = box.scrollHeight - box.clientHeight
  if (holds(end)) {
    stickyLimit = Infinity
  } else {
    let held = 0
    let lost = end
    while (lost - held > 1) {
      const middle = Math.floor((held + lost) / 2)
      if (holds(middle)) held = middle
      else lost = middle
    }
    stickyLimit = held
  }
  box.remove()
  return stickyLimit
}

/**
 * Сколько целых строк тела помещается в предел высоты вместе с шапкой и футером над и под
 * ним (`reserved`): Firefox режет всё, что дальше предела от начала области прокрутки.
 */
const reachableRows = (rowHeight: number, reserved: number) =>
  Math.floor((measureScrollHeightLimit() - reserved) / rowHeight)

/** Тело не выше предела браузера: выше Firefox даёт ему высоту 0 и список схлопывается (BH4). */
export const clampBodyHeight = (
  height: number,
  rowHeight: number,
  reserved: number,
): number =>
  height <= SAFE_HEIGHT || rowHeight <= 0 || typeof document === 'undefined'
    ? height
    : Math.min(height, reachableRows(rowHeight, reserved) * rowHeight)

/**
 * Список выше пределов браузера (BH5, BH6): dev-warn, что шапка перестаёт прилипать и что
 * строки за пределом высоты недоступны, с советом о пагинации.
 */
export const useScrollHeightWarning = (
  table: unknown,
  rowCount: number,
  rowHeight: number,
  reserved: number,
) => {
  const height = rowCount * rowHeight
  useEffect(() => {
    const host = table as LoggerHost
    if (height <= SAFE_HEIGHT || !shouldLog(host, 'warn')) return
    const sticky = measureStickyScrollLimit()
    if (height > sticky) {
      logWarn(
        host,
        `the header stops sticking after row ${Math.floor(sticky / rowHeight)} of ${rowCount}: the browser keeps it sticky for ${Math.round(sticky)}px of scroll — use pagination`,
        'stickyHeaderLimit',
      )
    }
    const reachable = reachableRows(rowHeight, reserved)
    if (rowCount > reachable) {
      logWarn(
        host,
        `rows after ${reachable} of ${rowCount} are out of reach: the browser caps the list at ${Math.round(measureScrollHeightLimit())}px — use pagination`,
        'scrollHeightLimit',
      )
    }
  }, [table, height, rowCount, rowHeight, reserved])
}

/** Сброс замеров между тестами. */
export const __resetScrollLimits = (): void => {
  heightLimit = undefined
  stickyLimit = undefined
}
