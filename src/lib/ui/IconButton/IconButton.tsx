import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'

import { Button as BaseButton } from '@base-ui/react/button'
import clsx from 'clsx'

import { type ButtonStatesProps, useButtonStates } from '../buttonStates'

import styles from './IconButton.module.css'

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStatesProps {
  /** Класс, применяемый в выключенном состоянии */
  disabledClassName?: string
  children?: ReactNode
}

/**
 * Круглая кнопка-иконка на базе Base UI Button (фундамент shadcn).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      disabledClassName,
      disabled,
      pending,
      errorFlash,
      onClick,
      children,
      ...rest
    },
    forwardedRef,
  ) => {
    const states = useButtonStates(
      forwardedRef,
      { pending, errorFlash },
      onClick,
    )

    return (
      <BaseButton
        type="button"
        disabled={disabled}
        {...rest}
        ref={states.ref}
        aria-busy={states['aria-busy'] ?? rest['aria-busy']}
        data-error-flash={states['data-error-flash']}
        onClick={states.onClick}
        className={clsx(
          styles.iconButton,
          states.className,
          className,
          disabled && disabledClassName,
        )}
      >
        {children}
      </BaseButton>
    )
  },
)

IconButton.displayName = 'IconButton'
