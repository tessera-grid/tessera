import {
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  forwardRef,
} from 'react'

import { Button as BaseButton } from '@base-ui/react/button'
import clsx from 'clsx'

import { Tooltip, type TooltipSide } from '../Tooltip'
import {
  type ButtonStatesProps,
  FailureMark,
  type FailureProps,
  useButtonStates,
  useFailure,
} from '../buttonStates'

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
    FailureProps,
    ButtonTooltipProps {
  /** Доступное имя и тултип кнопки. */
  label?: string
  /** `ghost` — прозрачная; `overlay` — непрозрачный чип поверх контента (действия строки). */
  variant?: 'ghost' | 'overlay'
  /** Форма: `circle` — круг (кнопки шапки, ячейки, строки), `square` — скруглённый квадрат (панели). */
  shape?: 'circle' | 'square'
  /** Размер: `compact` — `--tsr-comp-button-size-compact` (ручки перетаскивания). */
  size?: 'default' | 'compact'
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
      size = 'default',
      active = false,
      className,
      disabledClassName,
      disabled,
      focusableWhenDisabled,
      pending,
      errorFlash,
      failure,
      onClick,
      children,
      ...rest
    },
    forwardedRef,
  ) => {
    const busy = rest['aria-busy'] === true || rest['aria-busy'] === 'true'
    const states = useButtonStates(
      forwardedRef,
      { pending, errorFlash },
      onClick,
      busy,
    )
    const described = useFailure(failure, rest['aria-describedby'])

    const button = (
      <BaseButton
        type="button"
        aria-label={label}
        disabled={disabled}
        focusableWhenDisabled={focusableWhenDisabled || tooltipWhenDisabled}
        {...rest}
        aria-describedby={described.describedBy}
        ref={states.ref}
        aria-busy={states['aria-busy'] ?? rest['aria-busy']}
        data-error-flash={states['data-error-flash']}
        data-pending-leaving={states['data-pending-leaving']}
        data-variant={variant}
        data-shape={shape}
        data-size={size === 'compact' ? size : undefined}
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
        {failure !== undefined && (
          <FailureMark
            id={described.id}
            text={failure}
            shown={!states.active}
          />
        )}
        {states.arc}
      </BaseButton>
    )

    // Без подписи тултипа нет — и обёртки тоже: кнопок в гриде много; отметка отказа без
    // подписи — только описание. Занятая кнопка тултип не показывает; с отметкой отказа
    // тултип — её текст.
    return label ? (
      <Tooltip
        title={failure ?? label}
        side={tooltipSide}
        disabled={(!!disabled && !tooltipWhenDisabled) || pending || busy}
      >
        {button}
      </Tooltip>
    ) : (
      button
    )
  },
)

IconButton.displayName = 'IconButton'
