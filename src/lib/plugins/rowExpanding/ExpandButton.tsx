import { MouseEvent } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
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
  const { expand, expanded: expandedIcon } = useIcons()
  // Свой значок раскрытой строки заменяет шеврон и не поворачивается (ADR 0062, AI14).
  const swapped = expanded && expandedIcon !== expand
  const ExpandIcon = swapped ? expandedIcon : expand

  const labels = useLocalization()
  const label = expanded ? labels.collapseRow : labels.expandRow

  return (
    <div>
      <IconButton
        className="row-expand-button"
        disabled={disabled}
        pending={pending}
        errorFlash={errorFlash}
        aria-expanded={expanded}
        onClick={onClick}
        label={label}
      >
        <ExpandIcon
          width={16}
          height={16}
          className={clsx(styles.icon, {
            [styles.expanded]: expanded && !swapped,
            [styles.disabled]: disabled && !expanded,
          })}
        />
      </IconButton>
    </div>
  )
}

ExpandButton.displayName = 'ExpandButton'
