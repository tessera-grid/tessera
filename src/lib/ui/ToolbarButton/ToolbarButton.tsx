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
  /** Accessible name of the button. */
  label: string
  /** Button tooltip; its accessible name by default. */
  tooltip?: string
  icon: ReactNode
  /** Trigger of a popup (for example `<Popover.Trigger />`) — a Base UI render prop. */
  render?: ReactElement
}

/**
 * A top toolbar button (ADR 0035): the kit's icon button (ADR 0098) with a tooltip and Base UI
 * Toolbar roving focus. Lives only inside the grid toolbar.
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      label,
      tooltip,
      icon,
      active,
      count,
      activeIcon,
      indicator,
      indicatorTone,
      className,
      pending,
      failed,
      onCancel,
      cancelLabel,
      tooltipWhenDisabled,
      tone,
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
          tooltip={tooltip}
          shape="square"
          active={active}
          count={count}
          activeIcon={activeIcon}
          indicator={indicator}
          indicatorTone={indicatorTone}
          pending={pending}
          failed={failed}
          onCancel={onCancel}
          cancelLabel={cancelLabel}
          tooltipWhenDisabled={tooltipWhenDisabled}
          tone={tone}
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
