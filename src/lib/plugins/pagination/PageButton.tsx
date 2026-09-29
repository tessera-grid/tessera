/**
 * Кнопка пагинации — вид F4 (ADR 0035) вне тулбара: иконка с тултипом. На краю
 * набора заблокирована, но остаётся в порядке фокуса (PG13).
 */
import type { ReactNode } from 'react'

import { Button } from '@base-ui/react/button'

import { Tooltip } from '../../ui/Tooltip'
import styles from '../../ui/ToolbarButton/ToolbarButton.module.css'

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
  <Tooltip title={label}>
    <Button
      type="button"
      aria-label={label}
      disabled={disabled}
      focusableWhenDisabled
      className={styles.toolbarButton}
      data-page-action={action}
      onClick={onClick}
    >
      {icon}
    </Button>
  </Tooltip>
)
