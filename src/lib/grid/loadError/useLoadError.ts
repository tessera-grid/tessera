import { reportAction, sourceOf } from '../../core/debugActions'
import { useCallback, useEffect, useRef, useState } from 'react'

import { announceLabel } from '../../core/announcer'
import { hasLoadError, loadErrorReason } from '../../core/loadError'
import { useLatest } from '../../core/useLatest'

interface LoadErrorInput {
  table: unknown
  error: unknown
  onRetry?: () => unknown
  /** Приложение уже грузит заново (`loading`). */
  loading: boolean
  /** В теле есть строки: ошибка обновления, иначе — первой загрузки. */
  hasRows: boolean
  /** Заголовок плашки и объявления, если отказало не обновление (копирование, ADR 0146). */
  title?: string
}

/**
 * Состояние ошибки загрузки данных (ADR 0096): ключ новой ошибки (новое значение
 * `loadError` по `Object.is`), закрытие плашки до следующей ошибки, повтор с ожиданием
 * и одно объявление на ошибку.
 */
export const useLoadError = ({
  table,
  error,
  onRetry,
  loading,
  hasRows,
  title,
}: LoadErrorInput) => {
  const present = hasLoadError(error)
  const [tracked, setTracked] = useState({ error, key: present ? 1 : 0 })
  let key = tracked.key
  if (!Object.is(error, tracked.error)) {
    key = present ? tracked.key + 1 : tracked.key
    setTracked({ error, key })
  }

  const [dismissed, setDismissed] = useState<unknown>(undefined)
  const [retrying, setRetrying] = useState(false)
  const latestRetry = useLatest(onRetry)
  const retry = useCallback(
    (event?: unknown) => {
      reportAction(table, {
        plugin: 'core',
        action: 'retryLoad',
        source: sourceOf(event),
      })
      const result = latestRetry.current?.()
      if (
        typeof (result as PromiseLike<unknown> | undefined)?.then === 'function'
      ) {
        setRetrying(true)
        Promise.resolve(result)
          .catch(() => undefined)
          .finally(() => setRetrying(false))
      }
    },
    [latestRetry, table],
  )

  const pending = retrying || loading
  /*
   * Повтор из плашки прячет её: дальше видно синее свечение повтора. Плашка вернётся с
   * новой ошибкой или, если ошибка та же, когда загрузка повтора закончится.
   */
  const [retried, setRetried] = useState<{
    error: unknown
    started: boolean
  } | null>(null)
  if (retried) {
    if (!Object.is(retried.error, error)) {
      setRetried(null)
    } else if (!retried.started && pending) {
      setRetried({ error, started: true })
    } else if (retried.started && !pending) {
      setRetried(null)
    }
  }

  const reason = present ? loadErrorReason(error) : undefined
  const announced = useRef(0)
  useEffect(() => {
    if (!present || announced.current === key) {
      return
    }
    announced.current = key
    announceLabel(table, labels =>
      title
        ? reason
          ? `${title}. ${reason}`
          : title
        : hasRows
          ? reason
            ? labels.announceLoadErrorReason(reason)
            : labels.announceLoadError
          : reason
            ? labels.announceLoadFailedReason(reason)
            : labels.announceLoadFailed,
    )
  }, [table, present, key, hasRows, reason, title])

  return {
    present,
    /** Ключ вспышки красного света: есть только у ошибки обновления. */
    flashKey: present && hasRows ? key : undefined,
    reason,
    title,
    bannerShown: present && hasRows && !Object.is(dismissed, error) && !retried,
    stubShown: present && !hasRows,
    dismiss: () => setDismissed(error),
    retry: onRetry ? retry : undefined,
    /** Повтор из плашки: плашка уходит, повтор идёт. */
    retryFromBanner: onRetry
      ? (event?: unknown) => {
          setRetried({ error, started: false })
          retry(event)
        }
      : undefined,
    pending,
  }
}
