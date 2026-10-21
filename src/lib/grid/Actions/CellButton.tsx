import { ReactNode, memo } from 'react'

import clsx from 'clsx'

import {
  IconButton,
  type ActiveProps,
  type DerivedButtonProps,
  type RevealProps,
} from '../../ui/IconButton'

import '../cellControls/buttonVisibility.css'

export interface CellButtonProps
  extends DerivedButtonProps, RevealProps, ActiveProps {
  /** Тултип и доступное имя кнопки (`aria-label`). */
  label: string
  icon: ReactNode
}

export const CellButton = memo(
  ({
    label,
    icon,
    active,
    revealOnHover = true,
    ...button
  }: CellButtonProps) => (
    <div
      className={clsx('cell__button', revealOnHover && 'cell__button--hidden')}
      data-button-active={active || undefined}
    >
      <IconButton label={label} active={active} {...button}>
        {icon}
      </IconButton>
    </div>
  ),
)

CellButton.displayName = 'CellButton'
