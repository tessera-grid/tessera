import { MouseEvent, ReactNode, memo } from 'react'

import clsx from 'clsx'

import { IconButton } from '../../ui/IconButton'

import '../cellControls/buttonVisibility.css'

export interface CellEditButtonProps {
  /** Тултип и доступное имя кнопки (`aria-label`). */
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
    return (
      <div
        className={clsx('cell__button', {
          'cell__button--hidden': showOnHover,
        })}
      >
        <IconButton
          data-testid={testId}
          disabled={disabled}
          label={title}
          tooltipWhenDisabled={showTooltipWhenDisabled}
          onClick={onClick}
        >
          {icon}
        </IconButton>
      </div>
    )
  },
)

CellButton.displayName = 'CellButton'
