/**
 * Кнопка выбора размера страницы — и заглушка до загрузки списка, и его триггер:
 * ожидание дугой по контуру и отметка отказа (ADR 0127, ADR 0136). Ожидание серверного
 * действия — `aria-busy` и `data-pending` снаружи: оно нажатий не глушит (ADR 0116).
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
import styles from './Pagination.module.css'

export const SizeTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & ButtonStatesProps & FailureProps
>(
  (
    { pending, failure, onClick, className, children, ...rest },
    forwardedRef,
  ) => {
    const marked = rest['aria-busy'] === true || rest['aria-busy'] === 'true'
    const {
      ref: setButton,
      className: ringClassName,
      'aria-busy': busy,
      arc,
      active,
      ...states
    } = useButtonStates(
      forwardedRef,
      { pending, failed: failure !== undefined },
      onClick,
      marked,
    )
    const described = useFailure(failure, rest['aria-describedby'])
    return (
      <button
        type="button"
        {...rest}
        {...states}
        aria-busy={busy ?? rest['aria-busy']}
        aria-describedby={described.describedBy}
        ref={setButton}
        className={clsx(styles.trigger, ringClassName, className)}
      >
        {children}
        {failure !== undefined && (
          <FailureMark id={described.id} text={failure} shown={!active} />
        )}
        {arc}
      </button>
    )
  },
)

SizeTrigger.displayName = 'SizeTrigger'
