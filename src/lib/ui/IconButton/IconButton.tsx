import {
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  forwardRef,
} from 'react'

import { Button as BaseButton } from '@base-ui/react/button'
import clsx from 'clsx'

import { Tooltip, type TooltipSide } from '../Tooltip'
import { type ButtonStatesProps, useButtonStates } from '../buttonStates'

import styles from './IconButton.module.css'

export interface ButtonTooltipProps {
  /** Сторона тултипа. */
  tooltipSide?: TooltipSide
  /**
   * Тултип и у выключенной кнопки: она остаётся в порядке фокуса и под указателем
   * (`aria-disabled`), нажатия не доходят.
   */
  tooltipWhenDisabled?: boolean
}

export interface IconButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStatesProps,
    ButtonTooltipProps {
  /** Доступное имя и тултип кнопки. */
  label?: string
  /** `ghost` — прозрачная; `overlay` — непрозрачный чип поверх контента (действия строки). */
  variant?: 'ghost' | 'overlay'
  /** Форма: `circle` — круг (кнопки шапки, ячейки, строки), `square` — скруглённый квадрат (панели). */
  shape?: 'circle' | 'square'
  /** Активное состояние: сортировка, закрепление, открытый поповер. */
  active?: boolean
  /** Выключенная остаётся в порядке фокуса (`aria-disabled`) — Base UI Button. */
  focusableWhenDisabled?: boolean
  /** Свой элемент вместо кнопки (напр. `<Popover.Trigger />`) — рендер-проп Base UI. */
  render?: ReactElement
  /** Класс, применяемый в выключенном состоянии */
  disabledClassName?: string
  children?: ReactNode
}

/**
 * Кнопка-иконка кита (ADR 0098) на базе Base UI Button: сторона
 * `--tsr-comp-button-size`, иконка `--tsr-comp-button-icon-size`, форма `circle` или
 * `square`, палитра — общая с `Button`; `label` — доступное имя и тултип. Производные
 * кнопки собираются из неё.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      tooltipSide,
      tooltipWhenDisabled = false,
      variant = 'ghost',
      shape = 'circle',
      active = false,
      className,
      disabledClassName,
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
        aria-label={label}
        disabled={disabled}
        focusableWhenDisabled={focusableWhenDisabled || tooltipWhenDisabled}
        {...rest}
        ref={states.ref}
        aria-busy={states['aria-busy'] ?? rest['aria-busy']}
        data-error-flash={states['data-error-flash']}
        data-pending-leaving={states['data-pending-leaving']}
        data-variant={variant}
        data-shape={shape}
        data-active={active || undefined}
        onClick={states.onClick}
        className={clsx(
          'data-grid__icon-button',
          styles.iconButton,
          states.className,
          className,
          disabled && disabledClassName,
        )}
      >
        {children}
      </BaseButton>
    )

    // Без подписи тултипа нет — и обёртки тоже: кнопок в гриде много.
    return label ? (
      <Tooltip
        title={label}
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

IconButton.displayName = 'IconButton'
