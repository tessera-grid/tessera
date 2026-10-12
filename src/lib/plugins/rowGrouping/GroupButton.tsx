import { memo } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import { ActiveDot } from '../../grid/headerActions/ActiveDot'

import styles from './GroupButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

export interface GroupButtonProps {
  isGrouped: boolean
  onClick: () => void
  disabled?: boolean
}

export const GroupButton = memo(
  ({ isGrouped, onClick, disabled = false }: GroupButtonProps) => {
    const { group, grouped } = useIcons()
    const GroupIcon = isGrouped ? grouped : group

    const labels = useLocalization()

    const title = isGrouped ? labels.ungroup : labels.group

    return (
      <div
        className={clsx('cell__button', 'cell__button--hidden')}
        data-button-active={isGrouped}
      >
        <IconButton
          className="column-group__button"
          active={isGrouped}
          disabledClassName={styles.disabled}
          onClick={onClick}
          disabled={disabled}
          aria-disabled={disabled}
          label={title}
        >
          <GroupIcon width={16} height={16} />
          <ActiveDot shown={isGrouped} />
        </IconButton>
      </div>
    )
  },
)

GroupButton.displayName = 'GroupButton'
