import { ReactNode, memo } from 'react'

import clsx from 'clsx'

import {
  IconButton,
  type ActiveProps,
  type DerivedButtonProps,
  type RevealProps,
} from '../IconButton'
import { SimpleIconButton } from '../IconButton/IconButton'
import { HiddenButtonContext } from '../IconButton/iconReveal'

import '../cellControls/buttonVisibility.css'

export interface CellButtonProps
  extends DerivedButtonProps, RevealProps, ActiveProps {
  /** Tooltip and accessible name of the button (`aria-label`). */
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
      <HiddenButtonContext.Provider value={revealOnHover && !active}>
        <IconButton label={label} active={active} {...button}>
          {icon}
        </IconButton>
      </HiddenButtonContext.Provider>
    </div>
  ),
)

CellButton.displayName = 'CellButton'

export const SimpleCellButton = ({
  label,
  icon,
  onClick,
}: Pick<CellButtonProps, 'label' | 'icon' | 'onClick'>) => (
  <div className="cell__button cell__button--hidden">
    <HiddenButtonContext.Provider value={true}>
      <SimpleIconButton label={label} onClick={onClick}>
        {icon}
      </SimpleIconButton>
    </HiddenButtonContext.Provider>
  </div>
)
