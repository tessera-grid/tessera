import { memo, useMemo } from 'react'

import { SortDirection } from '@tanstack/react-table'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import {
  IconButton,
  type DerivedButtonProps,
  type RevealProps,
} from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'

import styles from './SortButton.module.css'
import '../../ui/cellControls/buttonVisibility.css'
import { columnSortingLabels } from './labels'

export interface SortButtonProps extends DerivedButtonProps, RevealProps {
  operation: SortDirection | false
  nextOperation: SortDirection | false
  /** Position of the column among the sorted ones (zero-based). */
  sortIndex?: number
  /** How many columns are sorted in total. */
  sortCount?: number
}

export const SortButton = memo(
  ({
    operation,
    nextOperation,
    sortIndex,
    sortCount = 0,
    revealOnHover = true,
    disabled = false,
    ...button
  }: SortButtonProps) => {
    const {
      sort: SortIcon,
      sortAsc: SortAscIcon,
      sortDesc: SortDescIcon,
    } = useIcons()

    const labels = useLocalization()

    const title = useMemo(() => {
      if (!operation && nextOperation === 'desc') {
        return columnSortingLabels(labels).sortDescending
      }

      if (!nextOperation) {
        return columnSortingLabels(labels).clearSort
      }

      return nextOperation === 'asc'
        ? columnSortingLabels(labels).sortAscending
        : columnSortingLabels(labels).sortDescending
    }, [labels, nextOperation, operation])

    const showIndex = sortIndex !== undefined
    const position = showIndex ? sortIndex + 1 : 0

    // Номер приоритета — число бабла (ADR 0129); скринридеру его несёт aria-label.
    const ariaLabel = showIndex
      ? `${title}, ${columnSortingLabels(labels).sortPriority(position, sortCount)}`
      : title

    return (
      <div
        className={clsx(
          'cell__button',
          revealOnHover && 'cell__button--hidden',
        )}
        data-button-active={!!operation}
      >
        <IconButton
          className="column-sort__button"
          active={!!operation}
          count={showIndex ? position : undefined}
          disabledClassName={styles.disabled}
          disabled={disabled}
          aria-disabled={disabled}
          label={title}
          aria-label={ariaLabel}
          {...button}
        >
          {operation === 'asc' && (
            <SortAscIcon data-icon="sortAsc" width={16} height={16} />
          )}
          {operation === 'desc' && (
            <SortDescIcon data-icon="sortDesc" width={16} height={16} />
          )}
          {!operation && <SortIcon data-icon="sort" width={16} height={16} />}
        </IconButton>
      </div>
    )
  },
)

SortButton.displayName = 'SortButton'
