/**
 * Плашка ожидания серверного действия (ADR 0153, §5): действие, ждущее дольше
 * `--tsr-comp-cancel-hint-delay`, — «Идёт поиск…» и кнопка «Отменить» под шапкой, на месте
 * плашки отказа. Плашка одна: отменяет все ждущие серверные действия и копирование.
 */
import { type RefObject, useEffect, useState } from 'react'

import clsx from 'clsx'

import { cancelPending, cancelSourceOf } from '../../core/cancellation'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import {
  type ServerActionKind,
  type ServerActionStatus,
  serverActionPendingTitle,
} from '../../core/serverActions'
import { Alert } from '../../ui/Alert'
import { Button } from '../../ui/Button'
import { parseDuration } from '../../util/cssTime'

import styles from './LoadError.module.css'

interface PendingActionBannerProps {
  table: unknown
  /** Элемент темы грида: из него читается задержка плашки. */
  themeRef: RefObject<HTMLElement | null>
  /** Плашка отказа на том же месте — главнее. */
  blocked: boolean
  /** Плашка уходит после отмены — фокус в тело грида. */
  onCancelled: () => void
}

/** Ждущее действие и его попытка; копирование — по времени начала. */
const pendingOf = (status: ServerActionStatus | undefined) => {
  const kind: ServerActionKind | undefined =
    status?.pending?.kind ?? (status?.copying ? 'copy' : undefined)
  const attempt = status?.pending?.attempt ?? status?.copying?.since
  return { kind, attempt }
}

/** Отменить всё, что показывает плашка. */
export const cancelServerPending = (table: unknown, event?: unknown) => {
  const source = cancelSourceOf(event)
  return (
    cancelPending(table, { kind: 'server' }, source) +
    cancelPending(table, { kind: 'copy' }, source)
  )
}

export const PendingActionBanner = ({
  table,
  themeRef,
  blocked,
  onCancelled,
}: PendingActionBannerProps) => {
  const labels = useLocalization()
  const { kind, attempt } = useTableState(table as never, state =>
    pendingOf((state as { serverAction?: ServerActionStatus }).serverAction),
  )
  // Попытка, чья задержка истекла; уходя, плашка держит заголовок последнего действия.
  const [due, setDue] = useState<number>()
  const [title, setTitle] = useState<ServerActionKind>()
  if (kind !== undefined && kind !== title) setTitle(kind)

  useEffect(() => {
    const el = themeRef.current
    if (attempt === undefined || !el) return
    const delay = parseDuration(
      getComputedStyle(el).getPropertyValue('--tsr-comp-cancel-hint-delay'),
    )
    const timer = setTimeout(() => setDue(attempt), delay)
    return () => clearTimeout(timer)
  }, [attempt, themeRef])

  const shown = kind !== undefined && due === attempt && !blocked
  return (
    <Alert
      shown={shown}
      className={clsx('data-grid__pending-action', styles.banner)}
      title={title ? serverActionPendingTitle(title, labels) : ''}
      action={
        <Button
          onClick={event => {
            if (cancelServerPending(table, event) > 0) onCancelled()
          }}
          data-testid="pending-action-cancel"
        >
          {labels.cancel}
        </Button>
      }
      data-testid="pending-action-banner"
    />
  )
}
