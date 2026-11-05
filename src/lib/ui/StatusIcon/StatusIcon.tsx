/**
 * Значок состояния кита (ADR 0183, PK16): фокусируемый значок с причиной — её имя для
 * скринридера и текст тултипа; тон ошибки или обычный.
 */
import type { ReactNode } from 'react'

import { Tooltip } from '../Tooltip'

import styles from './StatusIcon.module.css'

export interface StatusIconProps {
  /** Причина: доступное имя и тултип. */
  reason: string
  icon: ReactNode
  tone?: 'error' | 'neutral'
  'data-testid'?: string
}

export const StatusIcon = ({
  reason,
  icon,
  tone = 'error',
  ...rest
}: StatusIconProps) => (
  <Tooltip title={reason}>
    <span
      {...rest}
      className={styles.icon}
      data-tone={tone}
      role="img"
      aria-label={reason}
      tabIndex={0}
    >
      {icon}
    </span>
  </Tooltip>
)
