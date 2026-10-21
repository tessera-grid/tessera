import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton, type DerivedButtonProps } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'

import styles from './ExpandButton.module.css'

export interface ExpandButtonProps extends DerivedButtonProps {
  expanded: boolean
}

export const ExpandButton = ({
  expanded,
  disabled = false,
  ...button
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
        aria-expanded={expanded}
        label={label}
        {...button}
      >
        <ExpandIcon
          width={16}
          height={16}
          className={clsx(styles.icon, expanded && !swapped && styles.expanded)}
        />
      </IconButton>
    </div>
  )
}

ExpandButton.displayName = 'ExpandButton'
