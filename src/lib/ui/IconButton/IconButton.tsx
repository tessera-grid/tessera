import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'

import { Button as BaseButton } from '@base-ui/react/button'
import clsx from 'clsx'

import styles from './IconButton.module.css'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Класс, применяемый в выключенном состоянии */
  disabledClassName?: string
  children?: ReactNode
}

/**
 * Круглая кнопка-иконка на базе Base UI Button (фундамент shadcn).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, disabledClassName, disabled, children, ...rest }, ref) => (
    <BaseButton
      ref={ref}
      type="button"
      className={clsx(
        styles.iconButton,
        className,
        disabled && disabledClassName,
      )}
      disabled={disabled}
      {...rest}
    >
      {children}
    </BaseButton>
  ),
)

IconButton.displayName = 'IconButton'
