import { MouseEvent, ReactNode, memo } from 'react'

import clsx from 'clsx'

import { IconButton } from '../../ui/IconButton'

import '../cellControls/buttonVisibility.css'

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
    return (
      <div className={clsx('row__button', !isVisible && 'row__button--hidden')}>
        <IconButton
          data-testid={testId}
          variant="overlay"
          label={title}
          tooltipWhenDisabled={showTooltipWhenDisabled}
          onClick={onClick}
          disabled={disabled}
        >
          {icon}
        </IconButton>
      </div>
    )
  },
)

RowButton.displayName = 'RowButton'
