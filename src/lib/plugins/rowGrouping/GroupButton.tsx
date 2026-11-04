import { memo } from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import {
  IconButton,
  type DerivedButtonProps,
  type RevealProps,
} from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'

import styles from './GroupButton.module.css'
import '../../ui/cellControls/buttonVisibility.css'
import { rowGroupingLabels } from './labels'

export interface GroupButtonProps extends DerivedButtonProps, RevealProps {
  grouped: boolean
}

export const GroupButton = memo(
  ({
    grouped,
    revealOnHover = true,
    disabled = false,
    ...button
  }: GroupButtonProps) => {
    const { group: GroupIcon, grouped: GroupedIcon } = useIcons()

    const labels = useLocalization()

    const title = grouped
      ? rowGroupingLabels(labels).ungroup
      : rowGroupingLabels(labels).group

    return (
      <div
        className={clsx(
          'cell__button',
          revealOnHover && 'cell__button--hidden',
        )}
        data-button-active={grouped}
      >
        <IconButton
          className="column-group__button"
          active={grouped}
          activeIcon={<GroupedIcon width={16} height={16} />}
          disabledClassName={styles.disabled}
          disabled={disabled}
          aria-disabled={disabled}
          label={title}
          {...button}
        >
          <GroupIcon width={16} height={16} />
        </IconButton>
      </div>
    )
  },
)

GroupButton.displayName = 'GroupButton'
