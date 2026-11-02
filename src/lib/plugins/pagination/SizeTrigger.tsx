/**
 * Кнопка выбора размера страницы — и заглушка до загрузки списка, и его триггер:
 * ожидание загрузки списка дугой по контуру, отказ её останавливает (ADR 0127, ADR 0177, §2).
 * Взведённая отмена (ADR 0153) — «стоп» поверх значения, нажатие отменяет, а не открывает.
 */
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import clsx from 'clsx'

import {
  type ButtonStatesProps,
  type FailureProps,
  useButtonStates,
} from '../../ui/buttonStates'
import { useIcons } from '../../ui/icons'
import styles from './Pagination.module.css'

export const SizeTrigger = forwardRef<
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

SizeTrigger.displayName = 'SizeTrigger'
