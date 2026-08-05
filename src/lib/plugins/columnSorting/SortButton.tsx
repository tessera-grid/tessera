import { MouseEvent, memo, useMemo } from 'react'

import { SortDirection } from '@tanstack/react-table'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useIcons } from '../../ui/icons'

import headCellStyles from '../../ui/HeadCell/HeadCell.module.css'
import styles from './SortButton.module.css'

export interface SortButtonProps {
  operation: SortDirection | false
  nextOperation: SortDirection | false
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
}

export const SortButton = memo(
  ({
    operation,
    nextOperation,
    onClick,
    disabled = false,
  }: SortButtonProps) => {
    const {
      sort: SortIcon,
      sortAsc: SortAscIcon,
      sortDesc: SortDescIcon,
    } = useIcons()

    const labels = useLocalization()

    const title = useMemo(() => {
      if (!operation && nextOperation === 'desc') {
        return labels.sortDescending
      }

      if (!nextOperation) {
        return labels.clearSort
      }

      return nextOperation === 'asc'
        ? labels.sortAscending
        : labels.sortDescending
    }, [labels, nextOperation, operation])

    return (
      <Tooltip title={title} disabled={disabled}>
        <div
          className={clsx(
            headCellStyles.cell__button,
            headCellStyles['cell__button--hidden'],
          )}
          data-button-active={!!operation}
        >
          <IconButton
            className={clsx('column-sort__button', styles.root, {
              [styles.sorted]: !!operation,
            })}
            disabledClassName={styles.disabled}
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled}
          >
            {operation === 'asc' && <SortAscIcon width={16} height={16} />}
            {operation === 'desc' && <SortDescIcon width={16} height={16} />}
            {!operation && <SortIcon width={16} height={16} />}
          </IconButton>
        </div>
      </Tooltip>
    )
  },
)

SortButton.displayName = 'SortButton'
