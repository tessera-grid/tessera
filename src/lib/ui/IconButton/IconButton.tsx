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
  /** Tooltip side. */
  tooltipSide?: TooltipSide
  /**
   * Tooltip on a disabled button too: it stays in the focus order and under the pointer
   * (`aria-disabled`), presses don't go through.
   */
  tooltipWhenDisabled?: boolean
}

/** Action tone (ADR 0206): `danger` — the action irreversibly loses user data. */
export interface ToneProps {
  tone?: 'danger'
}

/**
 * Shared props of the kit's derived buttons (ADR 0128): busy state, stopping the arc on failure,
 * the disabled tooltip and the tone — as in the base.
 */
export interface DerivedButtonProps
  extends ButtonStatesProps, FailureProps, ToneProps {
  disabled?: boolean
  tooltipWhenDisabled?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  'data-testid'?: string
}

/**
 * Active state of a button (ADR 0129): icon color and a badge — a dot or a number. Only a button
 * that is passed `active` has the badge node.
 */
export interface ActiveProps {
  /** The action is on: a filter is set, columns are hidden, a mode is chosen. */
  active?: boolean
  /** A number in the badge instead of a dot — on an active button when `count` > 0. */
  count?: number
  /** Icon of the active button instead of the regular one; the badge stays. */
  activeIcon?: ReactNode
  /** `false` — no badge; the icon color stays. */
  indicator?: boolean
  /** Badge tone: `error` — the failure log's counter (ADR 0177, JR1). */
  indicatorTone?: 'active' | 'draft' | 'error'
  /**
   * Has something not applied (ADR 0178, §4): a dot in the unsaved color, the button is visible
   * without hover. With `active` the active state wins — the active dot.
   */
  draft?: boolean
}

/** Кнопка ячейки, заголовка или строки (ADR 0128). */
export interface RevealProps {
  /** Hidden until its area is hovered; an active or busy button is always visible. */
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
  /** Accessible name of the button. */
  label?: string
  /** Button tooltip; its accessible name by default. */
  tooltip?: string
  /** `ghost` — transparent; `overlay` — an opaque chip over content (row actions). */
  variant?: 'ghost' | 'overlay'
  /** Shape: `circle` (header, cell and row buttons), `square` — a rounded square (panels). */
  shape?: 'circle' | 'square'
  /** Size: `compact` — `--tsr-comp-button-size-compact` (drag handles). */
  size?: 'default' | 'compact'
  /** A disabled button stays in the focus order (`aria-disabled`) — Base UI Button. */
  focusableWhenDisabled?: boolean
  /** A custom element instead of the button (for example `<Popover.Trigger />`) — a Base UI render prop. */
  render?: ReactElement
  /** Class applied in the disabled state */
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
 * The kit's icon button (ADR 0098) built on Base UI Button: side `--tsr-comp-button-size`, icon
 * `--tsr-comp-button-icon-size`, shape `circle` or `square`, palette shared with `Button`;
 * `label` is the accessible name and the tooltip. Derived buttons are built from it.
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
