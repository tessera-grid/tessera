/**
 * Дефолтный инлайн-ввод редактирования ячейки: Enter и потеря фокуса — коммит
 * (ADR 0040, §3), Escape — отмена; на касании — кнопки «Готово» и «Отмена» (ADR 0231, §8).
 * Оформлен токенами темы и вписан в футпринт ячейки (CellEditInput.module.css); при
 * фокусе курсор встаёт в конец значения (без выделения).
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react'
import { Check, X } from 'lucide-react'

import { isTouchInput } from '../../core/inputModality'
import { SCROLLER_SELECTOR } from '../../core/keyboardNavigation/model'
import { scrollLayer } from '../../core/scrollStretch'
import { useLocalization } from '../../core/localization'
import { FieldError } from '../../ui/Field/Field'
import { IconButton } from '../../ui/IconButton'
import { cellEditingLabels } from './labels'
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
  const [touch] = useState(isTouchInput)
  const labels = cellEditingLabels(useLocalization())
  const errorId = useId()
  const input = useRef<HTMLInputElement>(null)
  // Без прокрутки к полю, как весь фокус грида: строка с полем может ехать к своему
  // месту (ADR 0107), и браузер прокрутил бы грид к её промежуточному положению.
  useLayoutEffect(() => {
    const element = input.current
    element?.focus({ preventScroll: true })
    element?.setSelectionRange(element.value.length, element.value.length)
  }, [])

  // Экранная клавиатура уменьшает видимую область: поле остаётся над ней (ADR 0231, §9).
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const keepVisible = () => {
      const element = input.current
      if (!element) return
      const bottom = viewport.offsetTop + viewport.height
      const over = () => element.getBoundingClientRect().bottom - bottom
      if (over() <= 0) return
      const scroller = element.closest<HTMLElement>(SCROLLER_SELECTOR)
      // Страницу к полю в фокусе браузер прокручивает сам; прокрутку грида — нет.
      if (scroller) scrollLayer(scroller).scrollBy(over())
    }
    viewport.addEventListener('resize', keepVisible)
    return () => viewport.removeEventListener('resize', keepVisible)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onCommit(value)
    }
    if (event.key === 'Escape') {
      onCancel()
    }
  }

  // Кнопка не забирает фокус у поля: потеря фокуса сохранила бы значение до «Отмены».
  const keepFocus = (event: SyntheticEvent) => event.preventDefault()

  const field = (
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
  )

  return (
    <span className={styles.field}>
      {touch ? (
        <span className={styles.touchRow}>
          {field}
          <IconButton
            label={labels.editDone}
            data-edit-action="done"
            onPointerDown={keepFocus}
            onMouseDown={keepFocus}
            onClick={() => onCommit(value)}
          >
            <Check width={16} height={16} />
          </IconButton>
          <IconButton
            label={labels.editCancel}
            data-edit-action="cancel"
            onPointerDown={keepFocus}
            onMouseDown={keepFocus}
            onClick={onCancel}
          >
            <X width={16} height={16} />
          </IconButton>
        </span>
      ) : (
        field
      )}
      {/* Всегда в DOM: скринридеры надёжно объявляют смену текста alert-области,
          а не вставку новой. */}
      <FieldError id={errorId} role="alert" compact className={styles.error}>
        {error}
      </FieldError>
    </span>
  )
}
