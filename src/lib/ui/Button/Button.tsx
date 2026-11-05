import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react'

import { Button as BaseButton } from '@base-ui/react/button'
import clsx from 'clsx'

import { type ButtonTooltipProps } from '../IconButton'
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
 * иконка, форма и палитра — общие с `IconButton` токены (ADR 0098); ожидание и отказ —
 * дуга, как у кнопок кита (ADR 0127, ADR 0136).
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
