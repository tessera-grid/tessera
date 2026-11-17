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
  /** Доступное имя кнопки. */
  label: string
  /** Тултип кнопки; по умолчанию — её доступное имя. */
  tooltip?: string
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
