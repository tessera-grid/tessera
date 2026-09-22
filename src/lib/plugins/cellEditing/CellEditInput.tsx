/**
 * Дефолтный инлайн-ввод редактирования ячейки: Enter — коммит, Escape/blur — отмена.
 * Оформлен токенами темы и вписан в футпринт ячейки (CellEditInput.module.css); при
 * фокусе курсор встаёт в конец значения (autoFocus, без выделения).
 */
import { useState, type KeyboardEvent } from 'react'

import styles from './CellEditInput.module.css'

interface CellEditInputProps {
  initialValue: string
  onCommit: (value: string) => void
  onCancel: () => void
}

export const CellEditInput = ({
  initialValue,
  onCommit,
  onCancel,
}: CellEditInputProps) => {
  const [value, setValue] = useState(initialValue)

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onCommit(value)
    }
    if (event.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <input
      autoFocus
      className={styles.input}
      value={value}
      onChange={event => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onCancel}
      aria-label="edit cell value"
    />
  )
}
