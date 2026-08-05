import { MouseEvent, ReactNode, memo } from 'react'

import clsx from 'clsx'

import { IconButton } from '../IconButton'
import { Tooltip } from '../Tooltip'
import { useRowButtonStyles } from './styles'

import bodyRowStyles from '../BodyRow/BodyRow.module.css'

export interface RowButtonProps {
  title: string
  icon: ReactNode
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  testId?: string
  showTooltipWhenDisabled?: boolean
  isVisible?: boolean
}

export const RowButton = memo(
  ({
    title,
    icon,
    disabled = false,
    onClick,
    testId,
    showTooltipWhenDisabled = false,
    isVisible = false,
  }: RowButtonProps) => {
    const styles = useRowButtonStyles()

    return (
      <Tooltip title={title} disabled={disabled && !showTooltipWhenDisabled}>
        <div
          className={clsx(
            bodyRowStyles.row__button,
            !isVisible && bodyRowStyles['row__button--hidden'],
          )}
        >
          <IconButton
            data-testid={testId}
            className={styles.root}
            disabledClassName={styles.disabled}
            onClick={onClick}
            disabled={disabled}
          >
            {icon}
          </IconButton>
        </div>
      </Tooltip>
    )
  },
)

RowButton.displayName = 'RowButton'
