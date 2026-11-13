/**
 * Плашка ожидания действия над всей таблицей (ADR 0153, §5): серверное действие или пункт
 * меню с целью `'table'`, ждущие дольше `--tsr-comp-cancel-hint-delay`, — «Идёт поиск…» и
 * кнопка «Отменить» под шапкой, на месте плашки отказа. Плашка одна: отменяет все такие
 * действия и догрузку строк.
 */
import { type RefObject, useEffect, useState } from 'react'

import clsx from 'clsx'

import { cancelPending, cancelSourceOf } from '../../core/cancellation'
import {
  cancelTableActions,
  pendingTableAction,
} from '../../core/headerActions/actionStatus'
import type { ActionStatus } from '../../core/headerActions/actionStatusFeature'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import {
  type ServerActionKind,
  type ServerActionStatus,
  serverActionPendingTitle,
} from '../../core/serverActions'
import { Alert } from '../../ui/Alert'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
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

interface PendingSlices {
  serverAction?: ServerActionStatus
  actionStatus?: ActionStatus
}

/** Ждущее действие и его попытка; догрузка строк и пункт меню — по времени начала. */
const pendingOf = ({ serverAction, actionStatus }: PendingSlices) => {
  const kind: ServerActionKind | undefined =
    serverAction?.pending?.kind ?? serverAction?.loadingRows?.kind
  const action = pendingTableAction(actionStatus)
  const attempt =
    serverAction?.pending?.attempt ??
    serverAction?.loadingRows?.since ??
    action?.since
  return {
    kind,
    attempt,
    name: action?.name,
    confirm: serverAction?.loadingRows?.confirm,
  }
}

/** Значение в вопросе вставки — одной строкой, длинное — с многоточием. */
const QUESTION_VALUE_LENGTH = 40
const clipped = (value: string) => {
  const line = value.replace(/s+/g, ' ').trim()
  return line.length > QUESTION_VALUE_LENGTH
    ? `${line.slice(0, QUESTION_VALUE_LENGTH - 1)}…`
    : line
}

/** Отменить всё, что показывает плашка. */
export const cancelServerPending = (table: unknown, event?: unknown) => {
  const source = cancelSourceOf(event)
  return (
    cancelPending(table, { kind: 'server' }, source) +
    cancelPending(table, { kind: 'copy' }, source) +
    cancelPending(table, { kind: 'selectPage' }, source) +
    cancelPending(table, { kind: 'paste' }, source) +
    cancelPending(table, { kind: 'fill' }, source) +
    cancelPending(table, { kind: 'history' }, source) +
    cancelTableActions(table, source)
  )
}

export const PendingActionBanner = ({
  table,
  themeRef,
  blocked,
  onCancelled,
}: PendingActionBannerProps) => {
  const labels = useLocalization()
  const icons = useIcons()
  const { kind, attempt, name, confirm } = useTableState(
    table as never,
    state => pendingOf(state as PendingSlices),
  )
  const heading = kind
    ? serverActionPendingTitle(kind, labels)
    : name && labels.pendingAction(name(labels))
  // Попытка, чья задержка истекла; уходя, плашка держит заголовок последнего действия.
  const [due, setDue] = useState<number>()
  const [title, setTitle] = useState('')
  if (heading && heading !== title) setTitle(heading)

  useEffect(() => {
    const el = themeRef.current
    if (attempt === undefined || !el) return
    const delay = parseDuration(
      getComputedStyle(el).getPropertyValue('--tsr-comp-cancel-hint-delay'),
    )
    const timer = setTimeout(() => setDue(attempt), delay)
    return () => clearTimeout(timer)
  }, [attempt, themeRef])

  const shown = !!heading && due === attempt && !blocked
  // Вопрос перед вставкой (ADR 0219, WR3): сразу, на месте плашки ожидания; галочка вставляет,
  // крестик отменяет вставку — как «Отмена» плашки.
  if (confirm && !blocked) {
    const ConfirmIcon = icons.pasteConfirm
    const DeclineIcon = icons.clear
    return (
      <Alert
        shown
        className={clsx('data-grid__pending-action', styles.banner)}
        title={
          confirm.value !== undefined && confirm.count === 1
            ? labels.pasteQuestionValue(clipped(confirm.value))
            : labels.pasteQuestionCount(confirm.count)
        }
        action={
          <span className={styles.questionButtons}>
            <IconButton
              label={labels.pasteConfirm}
              shape="square"
              onClick={confirm.accept}
              data-testid="paste-confirm"
            >
              <ConfirmIcon width={16} height={16} />
            </IconButton>
            {/* Отказ теряет вставляемое: тон отказа (ADR 0206). */}
            <IconButton
              label={labels.pasteDecline}
              shape="square"
              tone="danger"
              onClick={() => {
                if (cancelServerPending(table) > 0) onCancelled()
              }}
              data-testid="paste-decline"
            >
              <DeclineIcon width={16} height={16} />
            </IconButton>
          </span>
        }
        data-testid="paste-question"
      />
    )
  }
  return (
    <Alert
      shown={shown}
      className={clsx('data-grid__pending-action', styles.banner)}
      title={title}
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
