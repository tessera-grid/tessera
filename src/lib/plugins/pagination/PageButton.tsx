/**
 * Кнопка пагинации — кнопка-иконка кита (ADR 0098): иконка с тултипом. На краю
 * набора заблокирована, но остаётся в порядке фокуса (PG13). Ожидание и отказ начатого ею
 * запроса данных — под шапкой таблицы, а не на кнопке (ADR 0177, §1).
 */
import type { ReactNode } from 'react'

import { IconButton } from '../../ui/IconButton'
import type { PageControl } from './model'

export type PageAction = Exclude<PageControl, 'size'>

interface PageButtonProps {
  label: string
  icon: ReactNode
  disabled: boolean
  action: PageAction
  className?: string
  onClick: () => void
}

export const PageButton = ({
  label,
  icon,
  disabled,
  action,
  className,
  onClick,
}: PageButtonProps) => {
  return (
    <IconButton
      label={label}
      shape="square"
      className={className}
      disabled={disabled}
      tooltipWhenDisabled
      data-page-action={action}
      onClick={onClick}
    >
      {icon}
    </IconButton>
  )
}
