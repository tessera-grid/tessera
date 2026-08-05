import { memo } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useIcons } from '../../ui/icons'

import headCellStyles from '../../ui/HeadCell/HeadCell.module.css'
import styles from './GroupButton.module.css'

export interface GroupButtonProps {
  isGrouped: boolean
  onClick: () => void
  disabled?: boolean
}

export const GroupButton = memo(
  ({ isGrouped, onClick, disabled = false }: GroupButtonProps) => {
    const { group: GroupIcon } = useIcons()

    const labels = useLocalization()

    const title = isGrouped ? labels.ungroup : labels.group

    return (
      <Tooltip title={title} disabled={disabled}>
        <div
          className={clsx(
            headCellStyles.cell__button,
            headCellStyles['cell__button--hidden'],
          )}
          data-button-active={isGrouped}
        >
          <IconButton
            className={clsx('column-group__button', styles.root, {
              [styles.active]: isGrouped,
            })}
            disabledClassName={styles.disabled}
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled}
          >
            <GroupIcon width={16} height={16} />
          </IconButton>
        </div>
      </Tooltip>
    )
  },
)

GroupButton.displayName = 'GroupButton'
