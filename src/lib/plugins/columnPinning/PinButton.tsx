import { memo } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import { ActiveDot } from '../../grid/headerActions/ActiveDot'

import styles from './PinButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

export interface PinButtonProps {
  isPinned: boolean
  onClick: () => void
  disabled?: boolean
}

export const PinButton = memo(
  ({ isPinned, onClick, disabled = false }: PinButtonProps) => {
    const { pin, pinned } = useIcons()
    const PinIcon = isPinned ? pinned : pin

    const labels = useLocalization()

    const title = isPinned ? labels.unpin : labels.pin

    return (
      <div
        className={clsx('cell__button', 'cell__button--hidden')}
        data-button-active={isPinned}
      >
        <IconButton
          className="column-pin__button"
          active={isPinned}
          disabledClassName={styles.disabled}
          onClick={onClick}
          disabled={disabled}
          aria-disabled={disabled}
          label={title}
        >
          <PinIcon width={16} height={16} />
          <ActiveDot shown={isPinned} />
        </IconButton>
      </div>
    )
  },
)

PinButton.displayName = 'PinButton'
