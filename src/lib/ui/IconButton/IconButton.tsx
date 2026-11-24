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
import { useBubbleLook } from './bubbleLook'
import { RevealedIcon } from './iconReveal'
import { useIcons } from '../icons/IconsContext'
import ringStyles from '../ringStates/ringStates.module.css'

import styles from './IconButton.module.css'

const iconButtonClass = clsx('data-grid__icon-button', styles.iconButton)
const simpleIconButtonClass = clsx(iconButtonClass, ringStyles.ring)

export interface ButtonTooltipProps {
  /** Сторона тултипа. */
  tooltipSide?: TooltipSide
  /**
   * Тултип и у выключенной кнопки: она остаётся в порядке фокуса и под указателем
   * (`aria-disabled`), нажатия не доходят.
   */
  tooltipWhenDisabled?: boolean
}

/** Тон действия (ADR 0206): `danger` — действие безвозвратно теряет данные пользователя. */
export interface ToneProps {
  tone?: 'danger'
}

/**
 * Общие пропсы производных кнопок кита (ADR 0128): занятость, остановка дуги при отказе,
 * тултип выключенной и тон — как у базы.
 */
export interface DerivedButtonProps
  extends ButtonStatesProps, FailureProps, ToneProps {
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
   * Есть неприменённое (ADR 0178, §4): точка цвета несохранённого, кнопка видна без наведения.
   * С `active` главнее включённое — точка включённого.
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
    ActiveProps,
    ToneProps {
  /** Доступное имя кнопки. */
  label?: string
  /** Тултип кнопки; по умолчанию — её доступное имя. */
  tooltip?: string
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

/** Действие, состояние которого показывает сам владелец кнопки (ADR 0177). */
export const SimpleIconButton = ({
  label,
  onClick,
  children,
}: Pick<IconButtonProps, 'label' | 'onClick' | 'children'>) => {
  const button = (
    <BaseButton
      type="button"
      aria-label={label}
      data-variant="ghost"
      data-shape="circle"
      data-bare={children == null || undefined}
      onClick={onClick}
      className={simpleIconButtonClass}
    >
      <RevealedIcon always={false} holding={false}>
        {children}
      </RevealedIcon>
    </BaseButton>
  )
  return label ? (
    <Tooltip title={label} longPress>
      {button}
    </Tooltip>
  ) : (
    button
  )
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
      tooltip,
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
      tone,
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
    const {
      ref,
      className: stateClass,
      'aria-busy': pendingAriaBusy,
      'data-pending-leaving': pendingLeaving,
      onClick: handleClick,
      arc,
      active: pendingActive,
      armed,
    } = useButtonStates(
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
      pendingActive ||
      !!pendingLeaving

    // Неприменённое без включённого — точка несохранённого; включённое главнее.
    const drafted = !active && !!draft
    const {
      ref: bubbleRef,
      count: bubbleCount,
      tone: bubbleTone,
      shown: bubbleShown,
    } = useBubbleLook(
      {
        count: drafted || !count ? 0 : count,
        tone: drafted ? 'draft' : indicatorTone,
      },
      (!!active || !!draft) && indicator && !pendingActive,
    )
    const icons = useIcons()
    const CancelIcon = icons.cancelAction
    const name = armed ? (cancelLabel ?? label) : label
    const ariaName = armed ? (cancelLabel ?? accessibleName) : accessibleName

    const button = (
      <BaseButton
        type="button"
        disabled={disabled}
        focusableWhenDisabled={focusableWhenDisabled || tooltipWhenDisabled}
        {...rest}
        aria-label={ariaName}
        ref={ref}
        aria-busy={pendingAriaBusy ?? rest['aria-busy']}
        data-pending-leaving={pendingLeaving}
        data-variant={variant}
        data-shape={shape}
        data-size={size === 'compact' ? size : undefined}
        data-bare={children == null || undefined}
        data-active={active || undefined}
        data-draft={draft || undefined}
        data-tone={tone}
        data-cancel-armed={armed || undefined}
        onClick={handleClick}
        // Взведённый «стоп» отменяет, а не открывает меню, которое триггер открыл бы нажатием.
        onMouseDown={armed ? undefined : rest.onMouseDown}
        className={clsx(
          iconButtonClass,
          stateClass,
          className,
          disabled && disabledClassName,
        )}
      >
        <RevealedIcon always={ownStateShown} holding={expanded}>
          {active && activeIcon !== undefined ? activeIcon : children}
        </RevealedIcon>
        {(active !== undefined || draft !== undefined) && (
          <Bubble
            ref={bubbleRef}
            size={bubbleCount ? 'sm' : 'dot'}
            tone={bubbleTone}
            className={styles.indicator}
            data-active-indicator=""
            data-count={bubbleCount || undefined}
            data-shown={bubbleShown}
            aria-hidden
          >
            {bubbleCount ? countText(bubbleCount) : null}
          </Bubble>
        )}
        {armed && (
          <span className={styles.cancelIcon} aria-hidden data-cancel-icon="">
            <CancelIcon />
          </span>
        )}
        {arc}
      </BaseButton>
    )

    // Без подписи тултипа нет — и обёртки тоже: кнопок в гриде много. Занятая кнопка тултип
    // не показывает.
    return name || tooltip ? (
      <Tooltip
        title={tooltip ?? name}
        side={tooltipSide}
        longPress
        disabled={
          !armed && ((!!disabled && !tooltipWhenDisabled) || pending || busy)
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
