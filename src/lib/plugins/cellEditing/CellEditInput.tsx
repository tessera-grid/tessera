/**
 * Дефолтный инлайн-ввод редактирования ячейки: Enter и потеря фокуса — коммит
 * (ADR 0040, §3), Escape — отмена.
 * Оформлен токенами темы и вписан в футпринт ячейки (CellEditInput.module.css); при
 * фокусе курсор встаёт в конец значения (без выделения).
 */
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

import styles from './CellEditInput.module.css'

interface CellEditInputProps {
  initialValue: string
  label: string
  error?: string
  onCommit: (value: string) => void
  onCancel: () => void
  onDraftChange: (value: string) => void
  /** Клавиатура касания: `decimal` — у полей чисел (ADR 0175, ED4). */
  inputMode?: 'text' | 'decimal'
}

export const CellEditInput = ({
  initialValue,
  label,
  error,
  onCommit,
  onCancel,
  onDraftChange,
  inputMode,
}: CellEditInputProps) => {
  const [value, setValue] = useState(initialValue)
  const errorId = useId()
  const input = useRef<HTMLInputElement>(null)
  // Без прокрутки к полю, как весь фокус грида: строка с полем может ехать к своему
  // месту (ADR 0107), и браузер прокрутил бы грид к её промежуточному положению.
  useLayoutEffect(() => {
    const element = input.current
    element?.focus({ preventScroll: true })
    element?.setSelectionRange(element.value.length, element.value.length)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onCommit(value)
    }
    if (event.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <span className={styles.field}>
      <input
        ref={input}
        className={styles.input}
        value={value}
        inputMode={inputMode}
        onChange={event => {
          setValue(event.target.value)
          onDraftChange(event.target.value)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => onCommit(value)}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {/* Всегда в DOM: скринридеры надёжно объявляют смену текста alert-области,
          а не вставку новой. */}
      <span id={errorId} role="alert" className={styles.error}>
        {error}
      </span>
    </span>
  )
}
