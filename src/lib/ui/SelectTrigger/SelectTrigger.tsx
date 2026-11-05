/**
 * Кнопка выпадающего списка (ADR 0183, PK13): значение и шеврон; ожидание дугой по контуру,
 * отказ её останавливает (ADR 0127, ADR 0177, §2); взведённая отмена (ADR 0153) — «стоп» поверх
 * значения, нажатие отменяет, а не открывает. Триггер примитива — через `render`
 * (`<Select.Trigger render={<SelectTrigger />} />`), заглушка до загрузки списка — сама кнопка.
 */
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

import {
  type ButtonStatesProps,
  type FailureProps,
  useButtonStates,
} from '../buttonStates'
import { useIcons } from '../icons'

import styles from './SelectTrigger.module.css'

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & ButtonStatesProps & FailureProps
>(
  (
    {
      pending,
      failed,
      onCancel,
      cancelLabel,
      onClick,
      className,
      children,
      ...rest
    },
    forwardedRef,
  ) => {
    const marked = rest['aria-busy'] === true || rest['aria-busy'] === 'true'
    const {
      ref: setButton,
      className: ringClassName,
      'aria-busy': busy,
      arc,
      active: _active,
      armed,
      ...states
    } = useButtonStates(
      forwardedRef,
      { pending, failed, onCancel },
      onClick,
      marked,
    )
    const CancelIcon = useIcons().cancelAction
    // Взведённая кнопка — своё имя, а нажатие не открывает список: его открывают
    // `pointerdown`, `mousedown` и клавиши Base UI.
    const cancelOverrides = armed
      ? {
          'aria-labelledby': undefined,
          'aria-label': cancelLabel,
          title: cancelLabel,
          onPointerDown: undefined,
          onMouseDown: undefined,
          onKeyDown: undefined,
        }
      : {}
    return (
      <button
        type="button"
        {...rest}
        {...states}
        {...cancelOverrides}
        aria-busy={busy ?? rest['aria-busy']}
        data-cancel-armed={armed || undefined}
        ref={setButton}
        className={clsx(styles.trigger, ringClassName, className)}
      >
        {children}
        <span className={styles.icon} aria-hidden>
          <ChevronDown width={14} height={14} />
        </span>
        {armed && (
          <span className={styles.cancelIcon} aria-hidden data-cancel-icon="">
            <CancelIcon />
          </span>
        )}
        {arc}
      </button>
    )
  },
)

SelectTrigger.displayName = 'SelectTrigger'
