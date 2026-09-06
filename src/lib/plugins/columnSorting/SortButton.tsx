import { MouseEvent, memo, useMemo } from 'react'

import { SortDirection } from '@tanstack/react-table'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { Bubble } from '../../ui/Bubble'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useIcons } from '../../ui/icons'

import styles from './SortButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

export interface SortButtonProps {
  operation: SortDirection | false
  nextOperation: SortDirection | false
  /** Позиция столбца среди сортируемых (нумерация с нуля). */
  sortIndex?: number
  /** Сколько столбцов сортируется всего. */
  sortCount?: number
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
}

export const SortButton = memo(
  ({
    operation,
    nextOperation,
    sortIndex,
    sortCount = 0,
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

    const showIndex = sortIndex !== undefined
    const position = showIndex ? sortIndex + 1 : 0

    // Бейдж скрыт от скринридера (aria-hidden) — приоритет несёт aria-label.
    const ariaLabel = showIndex
      ? `${title}, ${labels.sortPriority(position, sortCount)}`
      : title

    return (
      <Tooltip title={title} disabled={disabled}>
        <div
          className={clsx('cell__button', 'cell__button--hidden')}
          data-button-active={!!operation}
        >
          <span className={styles.anchor}>
            <IconButton
              className={clsx('column-sort__button', styles.root, {
                [styles.sorted]: !!operation,
              })}
              disabledClassName={styles.disabled}
              onClick={onClick}
              disabled={disabled}
              aria-disabled={disabled}
              aria-label={ariaLabel}
            >
              {operation === 'asc' && <SortAscIcon width={16} height={16} />}
              {operation === 'desc' && <SortDescIcon width={16} height={16} />}
              {!operation && <SortIcon width={16} height={16} />}
            </IconButton>
            {showIndex && (
              <Bubble
                size="sm"
                className={clsx('column-sort__priority', styles.priority)}
                data-sort-priority={position}
                aria-hidden
              >
                {position}
              </Bubble>
            )}
          </span>
        </div>
      </Tooltip>
    )
  },
)

SortButton.displayName = 'SortButton'
