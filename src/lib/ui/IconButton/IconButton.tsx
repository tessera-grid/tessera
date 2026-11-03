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
  type FailureProps,
  useButtonStates,
} from '../buttonStates'
import { useActiveNameCheck } from './useActiveNameCheck'
import { RevealedIcon } from './iconReveal'
import { useIcons } from '../icons/IconsContext'

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
 * Общие пропсы производных кнопок кита (ADR 0128): занятость, остановка дуги при отказе и
 * тултип выключенной — как у базы.
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
  /** Тон бабла: `error` — счётчик отказов журнала (ADR 0177, JR1). */
  indicatorTone?: 'active' | 'draft' | 'error'
  /**
   * Есть неприменённое (ADR 0178, §4): кольцо вместо точки, кнопка видна без наведения. С
   * `active` главнее включённое — сплошная точка.
   */
  draft?: boolean
}

/** Кнопка ячейки, заголовка или строки (ADR 0128). */
export interface RevealProps {
  /** Скрыта до наведения на своё место; включённая и занятая видна всегда. */
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
      indicatorTone = 'active',
      draft,
      className,
      disabledClassName,
      disabled,
      focusableWhenDisabled,
      pending,
      failed,
      onClick,
      onCancel,
      cancelLabel,
      children,
      ...rest
    },
    forwardedRef,
  ) => {
    const busy = rest['aria-busy'] === true || rest['aria-busy'] === 'true'
    const states = useButtonStates(
      forwardedRef,
      { pending, failed, onCancel },
      onClick,
      busy,
    )
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
      !!draft ||
      !!pending ||
      busy ||
      states.active ||
      !!states['data-pending-leaving']

    // Неприменённое без включённого — кольцо; включённое главнее.
    const ringed = !active && !!draft
    const icons = useIcons()
    const CancelIcon = icons.cancelAction
    const name = states.armed ? (cancelLabel ?? label) : label
    const ariaName = states.armed
      ? (cancelLabel ?? accessibleName)
      : accessibleName

    const button = (
      <BaseButton
        type="button"
        disabled={disabled}
        focusableWhenDisabled={focusableWhenDisabled || tooltipWhenDisabled}
        {...rest}
        aria-label={ariaName}
        ref={states.ref}
        aria-busy={states['aria-busy'] ?? rest['aria-busy']}
        data-pending-leaving={states['data-pending-leaving']}
        data-variant={variant}
        data-shape={shape}
        data-size={size === 'compact' ? size : undefined}
        data-bare={children == null || undefined}
        data-active={active || undefined}
        data-draft={draft || undefined}
        data-cancel-armed={states.armed || undefined}
        onClick={states.onClick}
        // Взведённый «стоп» отменяет, а не открывает меню, которое триггер открыл бы нажатием.
        onMouseDown={states.armed ? undefined : rest.onMouseDown}
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
        {(active !== undefined || draft !== undefined) && (
          <Bubble
            size={count && !ringed ? 'sm' : 'dot'}
            tone={ringed ? 'draft' : indicatorTone}
            fill={ringed ? 'outline' : 'solid'}
            className={styles.indicator}
            data-active-indicator=""
            data-count={(!ringed && count) || undefined}
            data-fill={ringed ? 'outline' : undefined}
            data-shown={(!!active || !!draft) && indicator && !states.active}
            aria-hidden
          >
            {count && !ringed ? countText(count) : null}
          </Bubble>
        )}
        {states.armed && (
          <span className={styles.cancelIcon} aria-hidden data-cancel-icon="">
            <CancelIcon />
          </span>
        )}
        {states.arc}
      </BaseButton>
    )

    // Без подписи тултипа нет — и обёртки тоже: кнопок в гриде много. Занятая кнопка тултип
    // не показывает.
    return name ? (
      <Tooltip
        title={name}
        side={tooltipSide}
        disabled={
          !states.armed &&
          ((!!disabled && !tooltipWhenDisabled) || pending || busy)
        }
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
