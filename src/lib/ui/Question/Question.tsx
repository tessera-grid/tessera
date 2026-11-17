/**
 * Вопрос перед действием (ADR 0219, WR3; ADR 0223, LM2; ADR 0227, §6): плашка кита с текстом
 * вопроса и двумя квадратными кнопками — галочка соглашается, крестик отказывается. Кнопка, чьё
 * действие теряет данные, — в тоне опасного действия (ADR 0206).
 */
import { type MouseEvent, useEffect, useRef } from 'react'

import { Alert, type AlertProps } from '../Alert'
import { IconButton } from '../IconButton'
import { useIcons } from '../icons'

import styles from './Question.module.css'

export interface QuestionProps extends Omit<
  AlertProps,
  | 'shown'
  | 'action'
  | 'dismiss'
  | 'tone'
  | 'hideAfter'
  | 'onHide'
  | 'description'
> {
  confirmLabel: string
  declineLabel: string
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => void
  onDecline: (event: MouseEvent<HTMLButtonElement>) => void
  /** Какое из двух действий теряет данные. */
  danger: 'confirm' | 'decline'
  /** Фокус на кнопку при появлении: вопрос встал на место нажатой кнопки. */
  focusOnShow?: 'confirm' | 'decline'
}

export const Question = ({
  confirmLabel,
  declineLabel,
  onConfirm,
  onDecline,
  danger,
  focusOnShow,
  ...rest
}: QuestionProps) => {
  const { pasteConfirm: ConfirmIcon, clear: DeclineIcon } = useIcons()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const declineRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (focusOnShow === 'confirm') confirmRef.current?.focus()
    if (focusOnShow === 'decline') declineRef.current?.focus()
  }, [focusOnShow])
  return (
    <Alert
      {...rest}
      shown
      action={
        <span className={styles.buttons}>
          <IconButton
            ref={confirmRef}
            label={confirmLabel}
            shape="square"
            tone={danger === 'confirm' ? 'danger' : undefined}
            onClick={onConfirm}
            data-question-confirm=""
          >
            <ConfirmIcon width={16} height={16} />
          </IconButton>
          <IconButton
            ref={declineRef}
            label={declineLabel}
            shape="square"
            tone={danger === 'decline' ? 'danger' : undefined}
            onClick={onDecline}
            data-question-decline=""
          >
            <DeclineIcon width={16} height={16} />
          </IconButton>
        </span>
      }
    />
  )
}
