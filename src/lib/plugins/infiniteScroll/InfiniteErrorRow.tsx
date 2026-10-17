/**
 * Строка ошибки ленты с повтором (ADR 0081) — в конце таблицы: над закреплённым футером
 * и под незакреплённым (ADR 0118, §3). Загрузку повторяет загрузчик хвоста.
 */
import { sourceOf } from '../../core/debugActions'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

import type { BodyEndComponentProps } from '../../core/createSlots'
import { isFooterInline } from '../../core/footer'
import {
  NAV_BODY_END_ATTR,
  isKeyboardNavigationEnabled,
} from '../../core/keyboardNavigation'
import { useLocalization } from '../../core/localization'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'
import { Tooltip } from '../../ui/Tooltip'
import { loaderOf } from './loader'
import { infiniteScrollInertReason } from './model'
import type { InfiniteScrollState } from './types'

import styles from './InfiniteTail.module.css'

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
  const { loadMoreFailed: FailedIcon, retry: RetryIcon } = useIcons()
  const rowRef = useRef<HTMLDivElement>(null)
  const failed = value.status === 'error'

  // Блок ошибки — по центру видимой ширины области прокрутки, а не всей таблицы.
  const [viewportWidth, setViewportWidth] = useState<number>()
  useEffect(() => {
    const scroller = rowRef.current?.closest<HTMLElement>(
      '.data-grid__container',
    )
    if (!failed || !scroller) return
    const observer = new ResizeObserver(() =>
      setViewportWidth(scroller.clientWidth),
    )
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [failed])

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
      <div
        role="row"
        aria-rowindex={nextAriaRowIndex}
        className={styles['error-row']}
        data-testid="infinite-scroll-error"
      >
        <div
          role={navigable ? 'gridcell' : 'cell'}
          aria-colspan={leafColumns.length || undefined}
          className={styles['error-cell']}
          style={
            viewportWidth
              ? ({
                  '--tsr-load-more-viewport': `${viewportWidth}px`,
                } as CSSProperties)
              : undefined
          }
        >
          <div className={styles['error-message']}>
            <FailedIcon
              className={styles['error-icon']}
              width={18}
              height={18}
              aria-hidden="true"
            />
            <div className={styles['error-text']}>
              <div className={styles['error-title']}>
                {labels.loadMoreFailed}
              </div>
              {value.reason && (
                <Tooltip title={value.reason} overflowOnly>
                  <div className={styles['error-reason']}>{value.reason}</div>
                </Tooltip>
              )}
            </div>
          </div>
          <Button
            onClick={retry}
            onKeyDown={onRetryKeyDown}
            icon={<RetryIcon width={16} height={16} aria-hidden="true" />}
            {...{ [NAV_BODY_END_ATTR]: '' }}
          >
            {labels.loadMoreRetry}
          </Button>
        </div>
      </div>
    </div>
  )
}
