/**
 * Строка ошибки ленты с повтором (ADR 0081) — в конце таблицы: над закреплённым футером
 * и под незакреплённым (ADR 0118, §3). Загрузку повторяет загрузчик хвоста.
 */
import { sourceOf } from '../../core/debugActions'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useRef,
} from 'react'

import type { BodyEndComponentProps } from '../../core/createSlots'
import { isFooterInline } from '../../core/footer'
import { scrollLayer } from '../../core/scrollStretch'
import {
  NAV_BODY_END_ATTR,
  isKeyboardNavigationEnabled,
} from '../../core/keyboardNavigation'
import { useLocalization } from '../../core/localization'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { LoadMoreError } from '../../ui/LoadMoreError/LoadMoreError'
import { loaderOf } from './loader'
import { infiniteScrollInertReason } from './model'
import type { InfiniteScrollState } from './types'
import { infiniteScrollLabels } from './labels'

type InfiniteErrorRowProps = BodyEndComponentProps & {
  state: [InfiniteScrollState, (next: InfiniteScrollState) => void]
}

/** Активная ячейка клавиатурной навигации — туда фокус уходит из строки ошибки. */
const activeCellOf = (button: HTMLElement) =>
  button
    .closest('[role="grid"], [role="treegrid"]')
    ?.querySelector<HTMLElement>('[data-kn-active="true"]')

/** Ячейка закреплённого футера в колонке активной ячейки — она ниже строки ошибки. */
const footerCellBelow = (button: HTMLElement) => {
  const column = activeCellOf(button)?.getAttribute('aria-colindex')
  return button
    .closest('[role="grid"], [role="treegrid"]')
    ?.querySelector<HTMLElement>(
      `.data-grid__footer:not([data-position='inline']) [data-kn-cell]${
        column ? `[aria-colindex="${column}"]` : ''
      }`,
    )
}

/**
 * Выше строки ошибки — активная ячейка, а если она в закреплённом футере под строкой —
 * ячейка той же колонки в последней строке тела.
 */
const cellAbove = (button: HTMLElement) => {
  const active = activeCellOf(button)
  if (!active?.closest(".data-grid__footer:not([data-position='inline'])")) {
    return active
  }
  const rows = [
    ...(button
      .closest('[role="grid"], [role="treegrid"]')
      ?.querySelectorAll<HTMLElement>('.data-grid__body-row[data-index]') ??
      []),
  ]
  const last = rows.reduce<HTMLElement | undefined>(
    (found, row) =>
      !found || Number(row.dataset.index) > Number(found.dataset.index)
        ? row
        : found,
    undefined,
  )
  const column = active.getAttribute('aria-colindex')
  return (
    last?.querySelector<HTMLElement>(
      `[data-kn-cell][aria-colindex="${column}"]`,
    ) ?? active
  )
}

export const InfiniteErrorRow = ({
  table,
  leafColumns,
  nextAriaRowIndex,
  state: [value],
}: InfiniteErrorRowProps) => {
  const labels = useLocalization()
  const rowRef = useRef<HTMLDivElement>(null)
  const failed = value.status === 'error'

  // Под незакреплённым футером строка встаёт за нижним краем: у края — доводим в вид.
  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current
    const scroller = row?.closest<HTMLElement>('.data-grid__container')
    const atEdge = failed && !!loaderOf(table)?.takeFailedAtEdge()
    if (!atEdge || !row || !scroller || !isFooterInline(table)) return
    const bottom =
      scroller.getBoundingClientRect().top +
      scroller.clientTop +
      scroller.clientHeight
    const overflow = row.getBoundingClientRect().bottom - bottom
    if (overflow > 0) {
      scrollLayer(scroller).scrollBy(overflow)
    }
  }, [failed, table])

  if (!failed || infiniteScrollInertReason(table)) return null

  // Строка ошибки уходит вместе с кнопкой: фокус — на активную ячейку, а не на body.
  const retry = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    if (document.activeElement === button) {
      activeCellOf(button)?.focus({ preventScroll: true })
    }
    loaderOf(table)?.retry(sourceOf(event))
  }

  // Стрелки — по видимому порядку: вверх — к активной ячейке над строкой, вниз — к
  // закреплённому футеру под ней.
  const onRetryKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const target =
      event.key === 'ArrowUp'
        ? cellAbove(event.currentTarget)
        : event.key === 'ArrowDown' && !isFooterInline(table)
          ? footerCellBelow(event.currentTarget)
          : null
    if (target) {
      event.preventDefault()
      target.focus()
    }
  }

  const navigable = isKeyboardNavigationEnabled(table)

  return (
    <div ref={rowRef} role="rowgroup">
      <LoadMoreError
        title={infiniteScrollLabels(labels).loadMoreFailed}
        reason={value.reason}
        retryLabel={labels.loadMoreRetry}
        onRetry={retry}
        onRetryKeyDown={onRetryKeyDown}
        retryProps={{ [NAV_BODY_END_ATTR]: '' }}
        ariaRowIndex={nextAriaRowIndex}
        colSpan={leafColumns.length}
        navigable={navigable}
        testId="infinite-scroll-error"
      />
    </div>
  )
}
