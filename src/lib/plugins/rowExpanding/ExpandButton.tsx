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
  onClick: (e: MouseEvent) => void
}

export const ExpandButton = ({
  expanded,
  disabled = false,
  onClick,
}: ExpandButtonProps) => {
  const { expand: ExpandIcon } = useIcons()

  const labels = useLocalization()

  const label = expanded ? labels.collapse : labels.expand

  return (
    <Tooltip title={label} disabled={disabled}>
      <div>
        <IconButton
          className={clsx('row-expand-button', styles.button, {
            [styles.expanded]: expanded,
            [styles.disabled]: disabled && !expanded,
          })}
          disabled={disabled}
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
