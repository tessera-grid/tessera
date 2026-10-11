/**
 * Конец тела ленты (ADR 0081): у края просит следующий блок, пока он в пути рисует
 * скелет-строки, при отказе — строку ошибки с повтором. Смена сортировки, фильтров
 * или поиска отменяет загрузку и возвращает тело в начало.
 */
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

import type { BodyEndComponentProps } from '../../core/createSlots'
import {
  NAV_BODY_END_ATTR,
  isKeyboardNavigationEnabled,
} from '../../core/keyboardNavigation'
import { useLocalization } from '../../core/localization'
import { useIcons } from '../../ui/icons'
import { Tooltip } from '../../ui/Tooltip'
import { useTableState } from '../../core/reactivity'
import { SkeletonRows } from '../../grid/SkeletonBody'
import { InfiniteLoader } from './loader'
import { infiniteScrollInertReason } from './model'
import type { InfiniteScrollHooks, InfiniteScrollState } from './types'

import styles from './InfiniteTail.module.css'
import { useIsomorphicLayoutEffect } from '../../core/useIsomorphicLayoutEffect'

interface InfiniteOptions {
  infiniteScrollHasMore?: boolean
  infiniteScrollRowCount?: number
  infiniteScrollThreshold?: number
}

type InfiniteTailProps = BodyEndComponentProps & {
  hooks: Partial<InfiniteScrollHooks>
  state: [InfiniteScrollState, (next: InfiniteScrollState) => void]
}

const sameConditions = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])

export const InfiniteTail = ({
  table,
  layout,
  leafColumns,
  virtualColumns,
  isVirtualColumns,
  nextAriaRowIndex,
  hooks,
  state: [value, setValue],
}: InfiniteTailProps) => {
  const labels = useLocalization()
  const { loadMoreFailed: FailedIcon, retry: RetryIcon } = useIcons()
  const options = table.options as InfiniteOptions
  const inert = !!infiniteScrollInertReason(table)
  const hasMore = !!options.infiniteScrollHasMore
  const loaded = table.getCoreRowModel().rows.length
  const bodyRows = table.getRowModel().rows.length
  const [loader] = useState(() => new InfiniteLoader())
  const sentinelRef = useRef<HTMLDivElement>(null)

  useIsomorphicLayoutEffect(() => {
    loader.update({
      table,
      hooks,
      hasMore,
      loaded,
      rowCount: options.infiniteScrollRowCount,
      threshold: options.infiniteScrollThreshold,
      inert,
      setValue,
      sentinel: sentinelRef.current,
    })
  })

  // Край проверяется при прокрутке и после смены данных или состояния.
  useEffect(() => {
    if (value.status === 'idle') loader.check()
  }, [loader, loaded, hasMore, value.status, inert])

  useEffect(() => loader.listen(), [loader])

  // Смена условия выборки: ответ на прежнее устарел.
  const conditions = useTableState(table, s => [
    s.sorting,
    s.columnFilters,
    s.globalFilter,
  ])
  const previousConditions = useRef(conditions)
  useEffect(() => {
    if (sameConditions(previousConditions.current, conditions)) return
    previousConditions.current = conditions
    loader.cancel({ abort: true })
    loader.scrollToTop()
  }, [conditions, loader])

  // Ячейки хвоста — только пока его блок пересекает область прокрутки.
  const [tailInView, setTailInView] = useState(true)
  const pending = value.status === 'pending'
  useEffect(() => {
    const sentinel = sentinelRef.current
    const scroller = sentinel?.closest('.data-grid__container')
    const block = sentinel?.parentElement?.querySelector(
      '.data-grid__body--infinite-tail',
    )
    if (!pending || !scroller || !block) return
    const observer = new IntersectionObserver(
      ([entry]) => setTailInView(!!entry?.isIntersecting),
      { root: scroller },
    )
    observer.observe(block)
    return () => {
      observer.disconnect()
      // Следующая загрузка начинается у края — хвост сразу с ячейками.
      setTailInView(true)
    }
  }, [pending])

  // Блок ошибки — по центру видимой ширины области прокрутки, а не всей таблицы.
  const [viewportWidth, setViewportWidth] = useState<number>()
  const failed = value.status === 'error'
  useEffect(() => {
    const scroller = sentinelRef.current?.closest<HTMLElement>(
      '.data-grid__container',
    )
    if (!failed || !scroller) return
    const observer = new ResizeObserver(() =>
      setViewportWidth(scroller.clientWidth),
    )
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [failed])

  // Без грида загрузка не видна: поздний итог не оставляет таблицу «занятой».
  useEffect(() => () => loader.cancel({ abort: false }), [loader])

  /** Активная ячейка клавиатурной навигации — туда фокус уходит из строки ошибки. */
  const activeCellOf = (button: HTMLElement) =>
    button
      .closest('[role="grid"], [role="treegrid"]')
      ?.querySelector<HTMLElement>('[data-kn-active="true"]')

  // Строка ошибки уходит вместе с кнопкой: фокус — на активную ячейку, а не на body.
  const retry = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    if (document.activeElement === button) {
      activeCellOf(button)?.focus({ preventScroll: true })
    }
    loader.retry()
  }

  const onRetryKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp') return
    const active = activeCellOf(event.currentTarget)
    if (active) {
      event.preventDefault()
      active.focus()
    }
  }

  if (inert) return null

  const navigable = isKeyboardNavigationEnabled(table)

  return (
    <div style={{ display: 'contents' }} data-testid="infinite-scroll-tail">
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      {value.status === 'pending' && value.tailRows > 0 && (
        <SkeletonRows
          table={table}
          layout={layout}
          leafColumns={leafColumns}
          virtualColumns={virtualColumns}
          isVirtualColumns={isVirtualColumns}
          rowCount={value.tailRows}
          firstRowIndex={bodyRows}
          className="data-grid__body--infinite-tail"
          cells={tailInView}
        />
      )}
      {value.status === 'error' && (
        <div role="rowgroup">
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
                      <div className={styles['error-reason']}>
                        {value.reason}
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={styles.retry}
                onClick={retry}
                onKeyDown={onRetryKeyDown}
                {...{ [NAV_BODY_END_ATTR]: '' }}
              >
                <RetryIcon width={14} height={14} aria-hidden="true" />
                {labels.loadMoreRetry}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
