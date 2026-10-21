import { useId } from 'react'

import { Bubble } from '../Bubble'

import styles from '../ringStates/ringStates.module.css'

export interface FailureProps {
  /**
   * Отметка отказа (ADR 0127): текст — тултип вместо подписи и описание кнопки, точка
   * отказа — после вспышки. Текст собирает вызывающий.
   */
  failure?: string
}

/** Описание кнопки с отметкой: своё `aria-describedby` впереди переданного снаружи. */
export const useFailure = (
  failure: string | undefined,
  describedBy: string | undefined,
) => {
  const id = useId()
  return {
    id,
    describedBy:
      failure === undefined
        ? describedBy
        : [id, describedBy].filter(Boolean).join(' '),
  }
}

/**
 * Точка отказа в правом верхнем углу и скрытый текст описания. `shown` — пока кнопка не
 * в ожидании и не во вспышке.
 */
export const FailureMark = ({
  id,
  text,
  shown,
}: {
  id: string
  text: string
  shown: boolean
}) => (
  <>
    <Bubble
      size="dot"
      tone="error"
      className={styles.failure}
      data-failure-indicator=""
      data-shown={shown}
      aria-hidden
    />
    <span id={id} className={styles.failureText}>
      {text}
    </span>
  </>
)
