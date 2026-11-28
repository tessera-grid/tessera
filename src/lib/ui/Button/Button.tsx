import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react'

import { Button as BaseButton } from '@base-ui/react/button'
import clsx from 'clsx'

import { type ButtonTooltipProps, type ToneProps } from '../IconButton'
import { Tooltip } from '../Tooltip'
import {
  type ButtonStatesProps,
  type FailureProps,
  useButtonStates,
} from '../buttonStates'

import styles from './Button.module.css'

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStatesProps,
    FailureProps,
    ButtonTooltipProps,
    ToneProps {
  /** `outline` — with a border, on the grid surface; `ghost` — without a border, in popovers. */
  variant?: 'outline' | 'ghost'
  /** Icon before the label. */
  icon?: ReactNode
  /** Button tooltip. */
  tooltip?: ReactNode
  /** A disabled button stays in the focus order (`aria-disabled`) — Base UI Button. */
  focusableWhenDisabled?: boolean
  children: ReactNode
}

/**
 * A button with a label (ADR 0097) built on Base UI Button: a rounded square; size, icon, shape
 * and palette use the same tokens as `IconButton` (ADR 0098); pending and failure show as an arc,
 * like the kit's other buttons (ADR 0127, ADR 0136).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'outline',
      tone,
      icon,
      tooltip,
      tooltipSide,
      tooltipWhenDisabled = false,
      className,
      disabled,
      focusableWhenDisabled,
      pending,
      failed,
      onClick,
      children,
      ...rest
    },
    forwardedRef,
  ) => {
    const busy = rest['aria-busy'] === true || rest['aria-busy'] === 'true'
    const states = useButtonStates(
      forwardedRef,
      { pending, failed },
      onClick,
      busy,
    )

    const button = (
      <BaseButton
        type="button"
        disabled={disabled}
        focusableWhenDisabled={focusableWhenDisabled || tooltipWhenDisabled}
        {...rest}
        ref={states.ref}
        aria-busy={states['aria-busy'] ?? rest['aria-busy']}
        data-pending-leaving={states['data-pending-leaving']}
        data-variant={variant}
        data-tone={tone}
        data-with-icon={icon ? '' : undefined}
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
        {states.arc}
      </BaseButton>
    )

    // Обёртка — всегда: тултип появляется посреди жизни кнопки и не должен её перемонтировать
    // (без заголовка `Tooltip` рисует один триггер). Занятая кнопка тултип не показывает.
    return (
      <Tooltip
        title={tooltip}
        side={tooltipSide}
        disabled={(!!disabled && !tooltipWhenDisabled) || pending || busy}
      >
        {button}
      </Tooltip>
    )
  },
)

Button.displayName = 'Button'
