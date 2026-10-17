/**
 * Ошибка загрузки данных (ADR 0096): плашка под шапкой, когда данные есть (ошибка
 * обновления). Заглушку без данных рисует реестр заглушек (ADR 0123, запись `loadError`).
 * Плашка — примитив кита `Alert` (§9); грид ставит её под шапку.
 */
import { forwardRef } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { Alert } from '../../ui/Alert'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'

import styles from './LoadError.module.css'

interface RetryButtonProps {
  onRetry: (event?: unknown) => void
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
  retry?: (event?: unknown) => void
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
