/**
 * Строка ошибки загрузки строк с причиной и повтором (ADR 0081, ADR 0138): лента — в
 * конце таблицы, серверная модель — на месте отказавшего блока. Блок — по центру видимой
 * ширины области прокрутки.
 */
import {
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type Ref,
  useEffect,
  useRef,
  useState,
} from 'react'

import { Button } from '../Button'
import { useIcons } from '../icons'
import { Tooltip } from '../Tooltip'
import { assignRef } from '../assignRef'

import styles from './LoadMoreError.module.css'

export interface LoadMoreErrorProps {
  title: string
  reason?: string
  retryLabel: string
  onRetry: MouseEventHandler<HTMLButtonElement>
  onRetryKeyDown?: KeyboardEventHandler<HTMLButtonElement>
  /** Атрибуты кнопки повтора: метка клавиатурной навигации. */
  retryProps?: Record<string, string>
  ariaRowIndex?: number
  colSpan?: number
  /** Ячейка — `gridcell` под клавиатурной навигацией. */
  navigable: boolean
  rowRef?: Ref<HTMLDivElement>
  className?: string
  testId?: string
}

/**
 * Содержимое ошибки загрузки — значок, причина и повтор (ADR 0081, ADR 0175 ED24): строка
 * ошибки таблицы и список вариантов поповера показывают отказ одинаково.
 */
export const LoadErrorBlock = ({
  title,
  reason,
  retryLabel,
  onRetry,
  onRetryKeyDown,
  retryProps,
  testId,
}: Pick<
  LoadMoreErrorProps,
  | 'title'
  | 'reason'
  | 'retryLabel'
  | 'onRetry'
  | 'onRetryKeyDown'
  | 'retryProps'
> & { testId?: string }) => {
  const { loadMoreFailed: FailedIcon, retry: RetryIcon } = useIcons()
  return (
    <>
      <div className={styles['error-message']}>
        <FailedIcon
          className={styles['error-icon']}
          width={18}
          height={18}
          aria-hidden="true"
        />
        <div className={styles['error-text']}>
          <div className={styles['error-title']}>{title}</div>
          {reason && (
            <Tooltip title={reason} overflowOnly>
              <div className={styles['error-reason']}>{reason}</div>
            </Tooltip>
          )}
        </div>
      </div>
      <Button
        onClick={onRetry}
        onKeyDown={onRetryKeyDown}
        icon={<RetryIcon width={16} height={16} aria-hidden="true" />}
        data-testid={testId}
        {...retryProps}
      >
        {retryLabel}
      </Button>
    </>
  )
}

export const LoadMoreError = ({
  title,
  reason,
  retryLabel,
  onRetry,
  onRetryKeyDown,
  retryProps,
  ariaRowIndex,
  colSpan,
  navigable,
  rowRef,
  className,
  testId,
}: LoadMoreErrorProps) => {
  const ownRef = useRef<HTMLDivElement>(null)

  // Блок ошибки — по центру видимой ширины области прокрутки, а не всей таблицы.
  const [viewportWidth, setViewportWidth] = useState<number>()
  useEffect(() => {
    const scroller = ownRef.current?.closest<HTMLElement>(
      '.data-grid__container',
    )
    if (!scroller) return
    const observer = new ResizeObserver(() =>
      setViewportWidth(scroller.clientWidth),
    )
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={node => {
        ownRef.current = node
        assignRef(rowRef, node)
      }}
      role="row"
      aria-rowindex={ariaRowIndex}
      className={
        className ? `${styles['error-row']} ${className}` : styles['error-row']
      }
      data-testid={testId}
    >
      <div
        role={navigable ? 'gridcell' : 'cell'}
        aria-colspan={colSpan || undefined}
        className={styles['error-cell']}
        style={
          viewportWidth
            ? ({
                '--tsr-load-more-viewport': `${viewportWidth}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <LoadErrorBlock
          title={title}
          reason={reason}
          retryLabel={retryLabel}
          onRetry={onRetry}
          onRetryKeyDown={onRetryKeyDown}
          retryProps={retryProps}
        />
      </div>
    </div>
  )
}
