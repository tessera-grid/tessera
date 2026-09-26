/**
 * Дефолтный инлайн-ввод редактирования ячейки: Enter — коммит, Escape/blur — отмена.
 * Оформлен токенами темы и вписан в футпринт ячейки (CellEditInput.module.css); при
 * фокусе курсор встаёт в конец значения (autoFocus, без выделения).
 */
import { useId, useState, type KeyboardEvent } from 'react'

import styles from './CellEditInput.module.css'

interface CellEditInputProps {
  initialValue: string
  label: string
  error?: string
  onCommit: (value: string) => void
  onCancel: () => void
}

export const CellEditInput = ({
  initialValue,
  label,
  error,
  onCommit,
  onCancel,
}: CellEditInputProps) => {
  const [value, setValue] = useState(initialValue)
  const errorId = useId()

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
        autoFocus
        className={styles.input}
        value={value}
        onChange={event => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onCancel}
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
