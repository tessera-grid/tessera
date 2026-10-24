/**
 * Кнопка пагинации — кнопка-иконка кита (ADR 0098): иконка с тултипом. На краю
 * набора заблокирована, но остаётся в порядке фокуса (PG13). Начатое ею серверное
 * действие — свет ожидания и отметка отказа (ADR 0116, ADR 0136).
 */
import type { ReactNode } from 'react'

import { useLocalization } from '../../core/localization'
import {
  pendingAttributes,
  serverActionReason,
  useServerActionMarks,
} from '../../core/serverActions'
import { IconButton } from '../../ui/IconButton'
import { type PageControl, pageControl } from './model'

export type PageAction = Exclude<PageControl, 'size'>

interface PageButtonProps {
  table: unknown
  label: string
  icon: ReactNode
  disabled: boolean
  action: PageAction
  onClick: () => void
}

export const PageButton = ({
  table,
  label,
  icon,
  disabled,
  action,
  onClick,
}: PageButtonProps) => {
  const server = useServerActionMarks(
    table,
    cause => cause.control === pageControl(action),
  )
  const labels = useLocalization()
  return (
    <IconButton
      label={label}
      shape="square"
      disabled={disabled}
      tooltipWhenDisabled
      data-page-action={action}
      failure={
        server.failure && !server.pending
          ? labels.actionFailedRetry(serverActionReason(server.failure, labels))
          : undefined
      }
      {...pendingAttributes(server.pending)}
      onClick={onClick}
    >
      {icon}
    </IconButton>
  )
}
