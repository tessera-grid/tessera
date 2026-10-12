/**
 * Ошибка загрузки данных (ADR 0096): плашка под шапкой, когда данные есть (ошибка
 * обновления), и заглушка поверх пустого тела, когда данных нет (первая загрузка).
 */
import { forwardRef, useState, type ReactNode } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { useButtonStates } from '../../ui/buttonStates'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import { Tooltip } from '../../ui/Tooltip'
import { usePresence } from '../../ui/usePresence'

import styles from './LoadError.module.css'

export type ErrorStubRender =
  ReactNode | ((controls: { error: unknown; retry: () => void }) => ReactNode)

interface RetryButtonProps {
  onRetry: () => void
  pending: boolean
}

/** «Повторить»: пока повтор идёт, кнопка в ожидании и нажатия игнорирует. */
const RetryButton = forwardRef<HTMLButtonElement, RetryButtonProps>(
  ({ onRetry, pending }, forwardedRef) => {
    const labels = useLocalization()
    const { retry: RetryIcon } = useIcons()
    const {
      ref,
      className,
      onClick,
      'aria-busy': busy,
    } = useButtonStates(forwardedRef, { pending }, onRetry)
    return (
      <button
        type="button"
        ref={ref}
        className={clsx(styles.retry, className)}
        aria-busy={busy}
        onClick={onClick}
        data-testid="load-error-retry"
      >
        <RetryIcon width={14} height={14} aria-hidden="true" />
        {labels.loadRetry}
      </button>
    )
  },
)

RetryButton.displayName = 'RetryButton'

interface LoadErrorBannerProps {
  /** Плашка видна; уход — плавный, с последней причиной. */
  shown: boolean
  reason?: string
  /** Повтор: плашка уходит, дальше видно свечение повтора. */
  retry?: () => void
  onDismiss: () => void
}

/** Плашка ошибки обновления: поверх верха тела, раскладку не сдвигает. */
export const LoadErrorBanner = ({
  shown,
  reason: liveReason,
  retry,
  onDismiss,
}: LoadErrorBannerProps) => {
  const labels = useLocalization()
  const { loadFailed: FailedIcon, clear: DismissIcon } = useIcons()
  const { mounted, leaving, ref } = usePresence<HTMLDivElement>(shown)
  // Уходя, плашка держит последнюю причину: успешный повтор снимает ошибку раньше.
  const [reason, setReason] = useState(liveReason)
  if (shown && reason !== liveReason) {
    setReason(liveReason)
  }
  if (!mounted) {
    return null
  }
  return (
    <div
      ref={ref}
      className={clsx('data-grid__load-error', styles.banner)}
      role="group"
      aria-label={labels.loadErrorTitle}
      data-leaving={leaving || undefined}
      data-testid="load-error-banner"
    >
      <FailedIcon
        className={styles.icon}
        width={16}
        height={16}
        aria-hidden="true"
      />
      <div className={styles.text}>
        <span className={styles.title}>{labels.loadErrorTitle}</span>
        {reason && (
          <Tooltip title={reason} overflowOnly>
            <span className={styles.reason}>{reason}</span>
          </Tooltip>
        )}
      </div>
      {retry && <RetryButton onRetry={retry} pending={false} />}
      <Tooltip title={labels.loadErrorDismiss}>
        <IconButton
          aria-label={labels.loadErrorDismiss}
          className={styles.dismiss}
          onClick={onDismiss}
          data-testid="load-error-dismiss"
        >
          <DismissIcon width={14} height={14} />
        </IconButton>
      </Tooltip>
    </div>
  )
}

interface LoadErrorStubProps {
  error: unknown
  reason?: string
  retry?: () => void
  pending: boolean
  render?: ErrorStubRender
}

const noop = () => {}

/** Заглушка ошибки первой загрузки поверх пустого тела; шапка остаётся. */
export const LoadErrorStub = ({
  error,
  reason,
  retry,
  pending,
  render,
}: LoadErrorStubProps) => {
  const labels = useLocalization()
  const { loadFailed: FailedIcon } = useIcons()

  if (render !== undefined) {
    return (
      <div className={styles.stub} data-testid="load-error-stub">
        {typeof render === 'function'
          ? render({ error, retry: retry ?? noop })
          : render}
      </div>
    )
  }

  return (
    <div className={styles.stub} data-testid="load-error-stub">
      <FailedIcon
        className={styles.icon}
        width={24}
        height={24}
        aria-hidden="true"
      />
      <p className={styles['stub-title']}>{labels.loadFailedTitle}</p>
      {reason && (
        <Tooltip title={reason} overflowOnly>
          <p className={styles['stub-reason']}>{reason}</p>
        </Tooltip>
      )}
      {retry && <RetryButton onRetry={retry} pending={pending} />}
    </div>
  )
}
