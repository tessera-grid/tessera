import { memo } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import {
  IconButton,
  type DerivedButtonProps,
  type RevealProps,
} from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'

import styles from './PinButton.module.css'
import '../../ui/cellControls/buttonVisibility.css'
import { columnPinningLabels } from './labels'

export interface PinButtonProps extends DerivedButtonProps, RevealProps {
  pinned: boolean
}

export const PinButton = memo(
  ({
    pinned,
    revealOnHover = true,
    disabled = false,
    ...button
  }: PinButtonProps) => {
    const { pin: PinIcon, pinned: PinnedIcon } = useIcons()

    const labels = useLocalization()

    const title = pinned
      ? columnPinningLabels(labels).unpin
      : columnPinningLabels(labels).pin

    return (
      <div
        className={clsx(
          'cell__button',
          revealOnHover && 'cell__button--hidden',
        )}
        data-button-active={pinned}
      >
        <IconButton
          className="column-pin__button"
          active={pinned}
          activeIcon={<PinnedIcon width={16} height={16} />}
          disabledClassName={styles.disabled}
          disabled={disabled}
          aria-disabled={disabled}
          label={title}
          {...button}
        >
          <PinIcon width={16} height={16} />
        </IconButton>
      </div>
    )
  },
)

PinButton.displayName = 'PinButton'
