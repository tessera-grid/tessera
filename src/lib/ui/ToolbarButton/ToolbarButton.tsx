import {
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  forwardRef,
} from 'react'

import { Toolbar } from '@base-ui/react/toolbar'
import clsx from 'clsx'

import { Tooltip } from '../Tooltip'
import { type ButtonStatesProps, useButtonStates } from '../buttonStates'
import styles from './ToolbarButton.module.css'

export interface ToolbarButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    ButtonStatesProps {
  /** Тултип и доступное имя кнопки. */
  label: string
  icon: ReactNode
  /** Активное состояние (напр. часть колонок скрыта). */
  active?: boolean
  /** Триггер всплывающего окна (напр. `<Popover.Trigger />`) — рендер-проп Base UI. */
  render?: ReactElement
}

/**
 * Кнопка верхнего тулбара (семейство F4, ADR 0035): иконка с тултипом, квадратная
 * со скруглёнными углами. Живёт только внутри тулбара грида (roving-фокус Base UI).
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      label,
      icon,
      active = false,
      className,
      pending,
      errorFlash,
      onClick,
      ...rest
    },
    forwardedRef,
  ) => {
    const states = useButtonStates(
      forwardedRef,
      { pending, errorFlash },
      onClick,
    )

    return (
      <Tooltip title={label}>
        <Toolbar.Button
          type="button"
          aria-label={label}
          data-active={active || undefined}
          {...rest}
          ref={states.ref}
          aria-busy={states['aria-busy'] ?? rest['aria-busy']}
          data-error-flash={states['data-error-flash']}
          onClick={states.onClick}
          className={clsx(styles.toolbarButton, states.className, className)}
        >
          {icon}
        </Toolbar.Button>
      </Tooltip>
    )
  },
)

ToolbarButton.displayName = 'ToolbarButton'
