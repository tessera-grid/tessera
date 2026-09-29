import {
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  forwardRef,
} from 'react'

import { Toolbar } from '@base-ui/react/toolbar'
import clsx from 'clsx'

import { Tooltip } from '../Tooltip'
import styles from './ToolbarButton.module.css'

export interface ToolbarButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
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
  ({ label, icon, active = false, className, ...rest }, ref) => (
    <Tooltip title={label}>
      <Toolbar.Button
        ref={ref}
        type="button"
        aria-label={label}
        data-active={active || undefined}
        className={clsx(styles.toolbarButton, className)}
        {...rest}
      >
        {icon}
      </Toolbar.Button>
    </Tooltip>
  ),
)

ToolbarButton.displayName = 'ToolbarButton'
