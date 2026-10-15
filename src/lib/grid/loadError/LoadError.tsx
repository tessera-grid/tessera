/**
 * Ошибка загрузки данных (ADR 0096): плашка под шапкой, когда данные есть (ошибка
 * обновления), и заглушка поверх пустого тела, когда данных нет (первая загрузка).
 * Плашка — примитив кита `Alert` (§9); грид ставит её под шапку.
 */
import { forwardRef, type ReactNode } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { Alert } from '../../ui/Alert'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'
import { Tooltip } from '../../ui/Tooltip'

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
    return (
      <Button
        ref={forwardedRef}
        pending={pending}
        onClick={onRetry}
        icon={<RetryIcon width={16} height={16} aria-hidden="true" />}
        data-testid="load-error-retry"
      >
        {labels.loadRetry}
      </Button>
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
  reason,
  retry,
  onDismiss,
}: LoadErrorBannerProps) => {
  const labels = useLocalization()
  const { loadFailed: FailedIcon } = useIcons()
  return (
    <Alert
      shown={shown}
      className={clsx('data-grid__load-error', styles.banner)}
      icon={<FailedIcon width={16} height={16} />}
      title={labels.loadErrorTitle}
      description={reason}
      action={retry && <RetryButton onRetry={retry} pending={false} />}
      dismiss={{ label: labels.loadErrorDismiss, onClick: onDismiss }}
      data-testid="load-error-banner"
    />
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
