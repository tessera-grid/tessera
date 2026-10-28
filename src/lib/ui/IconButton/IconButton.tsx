import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  forwardRef,
} from 'react'

import { Button as BaseButton } from '@base-ui/react/button'
import clsx from 'clsx'

import { Bubble } from '../Bubble'
import { Tooltip, type TooltipSide } from '../Tooltip'
import {
  type ButtonStatesProps,
  FailureMark,
  type FailureProps,
  useButtonStates,
  useFailure,
} from '../buttonStates'
import { useActiveNameCheck } from './useActiveNameCheck'
import { RevealedIcon } from './iconReveal'

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

/**
 * Общие пропсы производных кнопок кита (ADR 0128): занятость, отказ и тултип
 * выключенной — как у базы.
 */
export interface DerivedButtonProps extends ButtonStatesProps, FailureProps {
  disabled?: boolean
  tooltipWhenDisabled?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  'data-testid'?: string
}

/**
 * Включённое состояние кнопки (ADR 0129): цвет значка и бабл — точка или число. Узел
 * бабла есть только у кнопки, которой передан `active`.
 */
export interface ActiveProps {
  /** Действие включено: фильтр задан, колонки скрыты, режим выбран. */
  active?: boolean
  /** Число в бабле вместо точки — у включённой кнопки при `count` > 0. */
  count?: number
  /** Значок включённой кнопки вместо обычного; бабл остаётся. */
  activeIcon?: ReactNode
  /** `false` — без бабла; цвет значка остаётся. */
  indicator?: boolean
}

/** Кнопка ячейки, заголовка или строки (ADR 0128). */
export interface RevealProps {
  /** Скрыта до наведения на своё место; включённая, занятая и с отметкой отказа видна всегда. */
  revealOnHover?: boolean
}

export interface IconButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStatesProps,
    FailureProps,
    ButtonTooltipProps,
    ActiveProps {
  /** Доступное имя и тултип кнопки. */
  label?: string
  /** `ghost` — прозрачная; `overlay` — непрозрачный чип поверх контента (действия строки). */
  variant?: 'ghost' | 'overlay'
  /** Форма: `circle` — круг (кнопки шапки, ячейки, строки), `square` — скруглённый квадрат (панели). */
  shape?: 'circle' | 'square'
  /** Размер: `compact` — `--tsr-comp-button-size-compact` (ручки перетаскивания). */
  size?: 'default' | 'compact'
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
      active,
      count,
      activeIcon,
      indicator = true,
      className,
      disabledClassName,
      disabled,
      focusableWhenDisabled,
      pending,
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
      { pending, failed: failure !== undefined },
      onClick,
      busy,
    )
    const described = useFailure(failure, rest['aria-describedby'])
    const accessibleName = rest['aria-label'] ?? label
    const ownState =
      rest['aria-pressed'] !== undefined ||
      rest['aria-expanded'] !== undefined ||
      rest['aria-checked'] !== undefined
    useActiveNameCheck(active, accessibleName, ownState)
    const expanded =
      rest['aria-expanded'] === true || rest['aria-expanded'] === 'true'
    // Своё состояние кнопки видно и без наведения — значок при нём есть (ADR 0149, §4).
    const ownStateShown =
      !!active ||
      !!pending ||
      busy ||
      failure !== undefined ||
      states.active ||
      !!states['data-pending-leaving']

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
        data-pending-leaving={states['data-pending-leaving']}
        data-variant={variant}
        data-shape={shape}
        data-size={size === 'compact' ? size : undefined}
        data-bare={children == null || undefined}
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
        <RevealedIcon always={ownStateShown} holding={expanded}>
          {active && activeIcon !== undefined ? activeIcon : children}
        </RevealedIcon>
        {active !== undefined && (
          <Bubble
            size={count ? 'sm' : 'dot'}
            tone="active"
            className={styles.indicator}
            data-active-indicator=""
            data-count={count || undefined}
            data-shown={
              active && indicator && !states.active && failure === undefined
            }
            aria-hidden
          >
            {count ? countText(count) : null}
          </Bubble>
        )}
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

/** Число бабла: больше 99 — «99+», полное число — в подписи кнопки. */
const countText = (count: number) => (count > 99 ? '99+' : String(count))
