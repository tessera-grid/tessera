import { MouseEvent, ReactNode, memo } from 'react'

import clsx from 'clsx'

import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useCellButtonStyles } from './styles'

import '../cellControls/buttonVisibility.css'

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
          className={clsx('cell__button', {
            'cell__button--hidden': showOnHover,
          })}
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
