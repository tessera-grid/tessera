/**
 * Кнопка пагинации — кнопка-иконка кита (ADR 0098): иконка с тултипом. На краю
 * набора заблокирована, но остаётся в порядке фокуса (PG13).
 */
import type { ReactNode } from 'react'

import { IconButton } from '../../ui/IconButton'

interface PageButtonProps {
  label: string
  icon: ReactNode
  disabled: boolean
  action: 'first' | 'previous' | 'next' | 'last'
  onClick: () => void
}

export const PageButton = ({
  label,
  icon,
  disabled,
  action,
  onClick,
}: PageButtonProps) => (
  <IconButton
    label={label}
    shape="square"
    disabled={disabled}
    tooltipWhenDisabled
    data-page-action={action}
    onClick={onClick}
  >
    {icon}
  </IconButton>
)
