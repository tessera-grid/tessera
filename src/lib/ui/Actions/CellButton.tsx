import { MouseEvent, ReactNode, memo } from 'react'

import clsx from 'clsx'

import { IconButton } from '../IconButton'
import { Tooltip } from '../Tooltip'
import { useCellButtonStyles } from './styles'

import bodyCellStyles from '../BodyCell/BodyCell.module.css'
import headCellStyles from '../HeadCell/HeadCell.module.css'

export interface CellEditButtonProps {
  title: string
  icon: ReactNode
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  showOnHover?: boolean
  showTooltipWhenDisabled?: boolean
  disabled?: boolean
  testId?: string
}

export const CellButton = memo(
  ({
    title,
    icon,
    showOnHover = true,
    showTooltipWhenDisabled = false,
    disabled = false,
    onClick,
    testId,
  }: CellEditButtonProps) => {
    const styles = useCellButtonStyles()

    return (
      <Tooltip title={title} disabled={disabled && !showTooltipWhenDisabled}>
        <div
          className={clsx(
            headCellStyles.cell__button,
            bodyCellStyles.cell__button,
            {
              [headCellStyles['cell__button--hidden']]: showOnHover,
              [bodyCellStyles['cell__button--hidden']]: showOnHover,
            },
          )}
        >
          <IconButton
            data-testid={testId}
            className={styles.root}
            disabledClassName={styles.disabled}
            disabled={disabled}
            onClick={onClick}
          >
            {icon}
          </IconButton>
        </div>
      </Tooltip>
    )
  },
)

CellButton.displayName = 'CellButton'
