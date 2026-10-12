import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react'

import { Button as BaseButton } from '@base-ui/react/button'
import clsx from 'clsx'

import { type ButtonTooltipProps } from '../IconButton'
import { Tooltip } from '../Tooltip'
import { type ButtonStatesProps, useButtonStates } from '../buttonStates'

import styles from './Button.module.css'

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStatesProps,
    ButtonTooltipProps {
  /** `outline` — с рамкой, на поверхности грида; `ghost` — без рамки, в поповерах. */
  variant?: 'outline' | 'ghost'
  /** Иконка перед подписью. */
  icon?: ReactNode
  /** Тултип кнопки. */
  tooltip?: ReactNode
  /** Выключенная остаётся в порядке фокуса (`aria-disabled`) — Base UI Button. */
  focusableWhenDisabled?: boolean
  children: ReactNode
}

/**
 * Кнопка с подписью (ADR 0097) на базе Base UI Button: скруглённый квадрат; размер,
 * иконка, форма и палитра — общие с `IconButton` токены (ADR 0098); ожидание и
 * вспышка ошибки — как у кнопок кита (ADR 0055).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'outline',
      icon,
      tooltip,
      tooltipSide,
      tooltipWhenDisabled = false,
      className,
      disabled,
      focusableWhenDisabled,
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

    const button = (
      <BaseButton
        type="button"
        disabled={disabled}
        focusableWhenDisabled={focusableWhenDisabled || tooltipWhenDisabled}
        {...rest}
        ref={states.ref}
        aria-busy={states['aria-busy'] ?? rest['aria-busy']}
        data-error-flash={states['data-error-flash']}
        data-pending-leaving={states['data-pending-leaving']}
        data-variant={variant}
        onClick={states.onClick}
        className={clsx(
          'data-grid__button',
          styles.button,
          states.className,
          className,
        )}
      >
        {icon}
        {children}
      </BaseButton>
    )

    return tooltip ? (
      <Tooltip
        title={tooltip}
        side={tooltipSide}
        disabled={!!disabled && !tooltipWhenDisabled}
      >
        {button}
      </Tooltip>
    ) : (
      button
    )
  },
)

Button.displayName = 'Button'
