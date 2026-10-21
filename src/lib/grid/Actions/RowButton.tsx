import { ReactNode, memo } from 'react'

import clsx from 'clsx'

import {
  IconButton,
  type ActiveProps,
  type DerivedButtonProps,
  type RevealProps,
} from '../../ui/IconButton'

import '../cellControls/buttonVisibility.css'

export interface RowButtonProps
  extends DerivedButtonProps, RevealProps, ActiveProps {
  /** Тултип и доступное имя кнопки (`aria-label`). */
  label: string
  icon: ReactNode
}

export const RowButton = memo(
  ({
    label,
    icon,
    active,
    revealOnHover = true,
    ...button
  }: RowButtonProps) => (
    <div
      className={clsx('row__button', revealOnHover && 'row__button--hidden')}
      data-button-active={active || undefined}
    >
      <IconButton variant="overlay" label={label} active={active} {...button}>
        {icon}
      </IconButton>
    </div>
  ),
)

RowButton.displayName = 'RowButton'
