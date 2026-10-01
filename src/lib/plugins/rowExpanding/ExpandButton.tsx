import { MouseEvent } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useIcons } from '../../ui/icons'

import styles from './ExpandButton.module.css'

export interface ExpandButtonProps {
  expanded: boolean
  disabled?: boolean
  /** Раскрытие ждёт промиса `onExpandRow` (ADR 0041). */
  pending?: boolean
  onClick: (e: MouseEvent) => void
}

export const ExpandButton = ({
  expanded,
  disabled = false,
  pending = false,
  onClick,
}: ExpandButtonProps) => {
  const { expand: ExpandIcon } = useIcons()

  const label = useLocalization().toggleRow

  return (
    <Tooltip title={label} disabled={disabled}>
      <div>
        <IconButton
          className={clsx('row-expand-button', styles.button, {
            [styles.expanded]: expanded,
            [styles.disabled]: disabled && !expanded,
            [styles.pending]: pending,
          })}
          disabled={disabled}
          aria-expanded={expanded}
          aria-busy={pending || undefined}
          onClick={onClick}
          aria-label={label}
        >
          <ExpandIcon width={20} height={20} />
        </IconButton>
      </div>
    </Tooltip>
  )
}

ExpandButton.displayName = 'ExpandButton'
