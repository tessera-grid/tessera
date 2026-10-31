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

export interface SortButtonProps extends DerivedButtonProps, RevealProps {
  operation: SortDirection | false
  nextOperation: SortDirection | false
  /** Позиция столбца среди сортируемых (нумерация с нуля). */
  sortIndex?: number
  /** Сколько столбцов сортируется всего. */
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
        return labels.sortDescending
      }

      if (!nextOperation) {
        return labels.clearSort
      }

      return nextOperation === 'asc'
        ? labels.sortAscending
        : labels.sortDescending
    }, [labels, nextOperation, operation])

    const showIndex = sortIndex !== undefined
    const position = showIndex ? sortIndex + 1 : 0

    // Номер приоритета — число бабла (ADR 0129); скринридеру его несёт aria-label.
    const ariaLabel = showIndex
      ? `${title}, ${labels.sortPriority(position, sortCount)}`
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
          {operation === 'asc' && <SortAscIcon width={16} height={16} />}
          {operation === 'desc' && <SortDescIcon width={16} height={16} />}
          {!operation && <SortIcon width={16} height={16} />}
        </IconButton>
      </div>
    )
  },
)

SortButton.displayName = 'SortButton'
