import {
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  forwardRef,
} from 'react'

import { Toolbar } from '@base-ui/react/toolbar'

import {
  IconButton,
  type ActiveProps,
  type DerivedButtonProps,
} from '../IconButton'

export interface ToolbarButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    DerivedButtonProps,
    ActiveProps {
  /** Тултип и доступное имя кнопки. */
  label: string
  icon: ReactNode
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
      active,
      count,
      activeIcon,
      indicator,
      className,
      pending,
      failure,
      tooltipWhenDisabled,
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
          count={count}
          activeIcon={activeIcon}
          indicator={indicator}
          pending={pending}
          failure={failure}
          tooltipWhenDisabled={tooltipWhenDisabled}
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
