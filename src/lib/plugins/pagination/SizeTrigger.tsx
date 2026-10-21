/**
 * Кнопка выбора размера страницы — и заглушка до загрузки списка, и его триггер:
 * ожидание и вспышка ошибки дугой по контуру (ADR 0055, ADR 0127). Ожидание серверного
 * действия — `aria-busy` и `data-pending` снаружи: оно нажатий не глушит (ADR 0116).
 */
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import clsx from 'clsx'

import { type ButtonStatesProps, useButtonStates } from '../../ui/buttonStates'
import styles from './Pagination.module.css'

export const SizeTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & ButtonStatesProps
>(
  (
    { pending, errorFlash, onClick, className, children, ...rest },
    forwardedRef,
  ) => {
    const marked = rest['aria-busy'] === true || rest['aria-busy'] === 'true'
    const {
      ref: setButton,
      className: ringClassName,
      'aria-busy': busy,
      arc,
      active: _active,
      ...states
    } = useButtonStates(forwardedRef, { pending, errorFlash }, onClick, marked)
    return (
      <button
        type="button"
        {...rest}
        {...states}
        aria-busy={busy ?? rest['aria-busy']}
        ref={setButton}
        className={clsx(styles.trigger, ringClassName, className)}
      >
        {children}
        {arc}
      </button>
    )
  },
)

SizeTrigger.displayName = 'SizeTrigger'
