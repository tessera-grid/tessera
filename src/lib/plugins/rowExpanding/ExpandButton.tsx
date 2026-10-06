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
  /** Раскрытие ждёт промиса `onExpandRow` / `loadChildren` (ADR 0041, 0054). */
  pending?: boolean
  /** Номер последней неудачной попытки — ключ вспышки контура (ADR 0055). */
  errorFlash?: number
  onClick: (e: MouseEvent) => void
}

export const ExpandButton = ({
  expanded,
  disabled = false,
  pending = false,
  errorFlash,
  onClick,
}: ExpandButtonProps) => {
  const { expand: ExpandIcon } = useIcons()

  const label = useLocalization().toggleRow

  return (
    <Tooltip title={label} disabled={disabled}>
      <div>
        <IconButton
          className="row-expand-button"
          disabled={disabled}
          pending={pending}
          errorFlash={errorFlash}
          aria-expanded={expanded}
          onClick={onClick}
          aria-label={label}
        >
          <ExpandIcon
            width={20}
            height={20}
            className={clsx(styles.icon, {
              [styles.expanded]: expanded,
              [styles.disabled]: disabled && !expanded,
            })}
          />
        </IconButton>
      </div>
    </Tooltip>
  )
}

ExpandButton.displayName = 'ExpandButton'
