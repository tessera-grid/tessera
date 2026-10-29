/**
 * Кнопка выбора размера страницы — и заглушка до загрузки списка, и его триггер:
 * ожидание дугой по контуру и отметка отказа (ADR 0127, ADR 0136). Ожидание серверного
 * действия — `aria-busy` и `data-pending` снаружи: оно нажатий не глушит (ADR 0116).
 * Взведённая отмена (ADR 0153) — «стоп» поверх значения, нажатие отменяет, а не открывает.
 */
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import clsx from 'clsx'

import {
  type ButtonStatesProps,
  FailureMark,
  type FailureProps,
  useButtonStates,
  useFailure,
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
      failure,
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
      active,
      armed,
      ...states
    } = useButtonStates(
      forwardedRef,
      { pending, failed: failure !== undefined, onCancel },
      onClick,
      marked,
    )
    const described = useFailure(failure, rest['aria-describedby'])
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
        aria-describedby={described.describedBy}
        data-cancel-armed={armed || undefined}
        ref={setButton}
        className={clsx(styles.trigger, ringClassName, className)}
      >
        {children}
        {failure !== undefined && (
          <FailureMark id={described.id} text={failure} shown={!active} />
        )}
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
