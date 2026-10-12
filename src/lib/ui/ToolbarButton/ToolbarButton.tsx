import {
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  forwardRef,
} from 'react'

import { Toolbar } from '@base-ui/react/toolbar'

import { IconButton } from '../IconButton'
import { type ButtonStatesProps } from '../buttonStates'

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
 * Кнопка верхнего тулбара (ADR 0035): кнопка-иконка кита (ADR 0098) с тултипом и
 * roving-фокусом Base UI Toolbar. Живёт только внутри тулбара грида.
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
      render,
      ...rest
    },
    forwardedRef,
  ) => (
    <Toolbar.Button
      {...rest}
      ref={forwardedRef}
      render={
        <IconButton
          label={label}
          shape="square"
          active={active}
          pending={pending}
          errorFlash={errorFlash}
          onClick={onClick}
          className={className}
          render={render}
        />
      }
    >
      {icon}
    </Toolbar.Button>
  ),
)

ToolbarButton.displayName = 'ToolbarButton'
