import { useEffect } from 'react'

import { logWarn } from './logger'

/** Ниже этого тело заведомо помещается в любом браузере — мерить незачем. */
const SAFE_HEIGHT = 10_000_000

let limit: number | undefined

/**
 * Наибольшая высота элемента в браузере: высоту сверх неё браузер обрезает. Меряется
 * один раз — заведомо огромным блоком.
 */
export const measureScrollHeightLimit = (): number => {
  if (limit !== undefined) return limit
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;height:1e9px'
  document.body.append(probe)
  limit = probe.getBoundingClientRect().height
  probe.remove()
  return limit
}

/**
 * Список выше предела браузера не прокрутить до конца (ADR 0138, §5, SD18): dev-warn с
 * советом о пагинации.
 */
export const useScrollHeightWarning = (
  table: unknown,
  rowCount: number,
  rowHeight: number,
) => {
  const height = rowCount * rowHeight
  useEffect(() => {
    if (height <= SAFE_HEIGHT || height <= measureScrollHeightLimit()) return
    logWarn(
      table as never,
      `${rowCount} rows are taller than the browser can scroll (${Math.round(measureScrollHeightLimit())}px): use pagination`,
      'scrollHeightLimit',
    )
  }, [table, height, rowCount])
}
