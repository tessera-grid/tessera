/** Инлайн-ввод редактирования ячейки: Enter — коммит, Escape/blur — отмена. */
import { useState, type KeyboardEvent } from 'react'

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
      value={value}
      onChange={event => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onCancel}
      aria-label="edit cell value"
    />
  )
}
