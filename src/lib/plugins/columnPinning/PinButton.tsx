import { memo } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useIcons } from '../../ui/icons'

import headCellStyles from '../../ui/HeadCell/HeadCell.module.css'
import styles from './PinButton.module.css'

export interface PinButtonProps {
  isPinned: boolean
  onClick: () => void
  disabled?: boolean
}

export const PinButton = memo(
  ({ isPinned, onClick, disabled = false }: PinButtonProps) => {
    const { pin: PinIcon } = useIcons()

    const labels = useLocalization()

    const title = isPinned ? labels.unpin : labels.pin

    return (
      <Tooltip title={title} disabled={disabled}>
        <div
          className={clsx(
            headCellStyles.cell__button,
            headCellStyles['cell__button--hidden'],
          )}
          data-button-active={isPinned}
        >
          <IconButton
            className={clsx('column-pin__button', styles.root, {
              [styles.pinned]: isPinned,
            })}
            disabledClassName={styles.disabled}
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled}
          >
            <PinIcon width={16} height={16} />
          </IconButton>
        </div>
      </Tooltip>
    )
  },
)

PinButton.displayName = 'PinButton'
