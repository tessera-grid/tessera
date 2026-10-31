// Ленивая граница кебаб-/инлайн-меню: `@base-ui/react/menu` тянет
// floating-ui-позиционирование, поэтому ActionMenu/ActionInlineMenu живут в
// отдельном чанке. Обёртки эагерные: держат состояние `open` и рисуют
// плейсхолдер-триггер, пока чанк грузится. Клик по плейсхолдеру ставит `open`, а
// контролируемый impl открывается сразу после догрузки — без потери клика. Замену
// плейсхолдера ведёт состояние (`usePreloaded`), а не повтор Suspense-границы: React
// может отложить этот повтор до следующего рендера кнопки, и тогда она сменится
// посреди клика.
import { actionDetailOf, actionOwnerOf } from '../../core/actionOwners'
import { Suspense, useState } from 'react'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { useLazyPopover } from '../../core/lazyOpening'
import { preloadable, usePreloaded } from '../../core/preloadable'
import { IconButton } from '../../ui/IconButton'
import { HiddenButtonContext } from '../../ui/IconButton/iconReveal'
import { useIcons } from '../../ui/icons'
import {
  countActiveActions,
  preloadActionPanel,
  type SlotAction,
} from '../../core/headerActions'
import { ErrorDot, kebabActive } from './ErrorDot'
import type { ActionMenuProps } from './ActionMenu'
import type { ActionInlineMenuProps } from './ActionInlineMenu'
import type { ActionPanelProps } from './ActionPanel'
import {
  type PanelButtonState,
  panelButtonProps,
  usePanelOpening,
} from './usePanelOpening'
import { type KebabState, useKebabState } from './useKebabState'

import styles from '../../ui/Popup/ActionMenu.module.css'
import '../../ui/cellControls/buttonVisibility.css'

const ActionMenuImpl = preloadable(() =>
  import('./ActionMenu').then(m => m.ActionMenu),
)

const ActionInlineMenuImpl = preloadable(() =>
  import('./ActionInlineMenu').then(m => m.ActionInlineMenu),
)

const ActionPanelImpl = preloadable(() =>
  import('./ActionPanel').then(m => m.ActionPanel),
)

type Variant = 'cell' | 'row'

/** Ожидание и ошибка загрузки модуля — для кнопки-заглушки (ADR 0061). */
const loadingOf = (
  popover: ReturnType<typeof useLazyPopover>,
): PanelButtonState => ({
  pending: popover.trigger.pending,
  failure: popover.trigger.failure,
  onIntent: () => {},
  onCancel: popover.opening.cancel,
})

/** Фолбэк кебаб-триггера: тот же IconButton с иконкой ⋮, но без Base UI-обвязки. */
const KebabPlaceholder = ({
  variant,
  open,
  onOpen,
  loading,
  activeCount,
  active,
  kebab,
}: {
  variant: Variant
  activeCount: number
  /** Включён кебаб — узел бабла только у кебаба с включаемыми действиями (ADR 0129). */
  active: boolean | undefined
  open: boolean
  onOpen: () => void
  loading: PanelButtonState
  kebab: KebabState
}) => {
  const { menu: MenuIcon } = useIcons()

  const trigger = (
    <IconButton
      className={styles.trigger}
      label={kebab.title}
      aria-label={kebab.ariaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      data-action-menu={variant}
      onClick={onOpen}
      onPointerLeave={kebab.leave}
      active={active}
      indicator={!kebab.failed}
      {...panelButtonProps(loading)}
    >
      <MenuIcon width={16} height={16} />
      <ErrorDot shown={kebab.failed} />
    </IconButton>
  )

  const shown = open || loading.pending || activeCount > 0 || kebab.failed
  return variant === 'row' ? (
    <div className={clsx('row__button', !shown && 'row__button--hidden')}>
      <HiddenButtonContext.Provider value={!shown}>
        {trigger}
      </HiddenButtonContext.Provider>
    </div>
  ) : (
    <div
      className="cell__button cell__button--hidden"
      data-button-active={shown}
    >
      <HiddenButtonContext.Provider value={!shown}>
        {trigger}
      </HiddenButtonContext.Provider>
    </div>
  )
}

/** Фолбэк инлайн-триггера: кнопка действия без Base UI-обвязки. */
const InlinePlaceholder = ({
  action,
  context,
  variant,
  open,
  onOpen,
  loading,
  popup = 'menu',
}: {
  action: SlotAction
  context: any
  variant: Variant
  open: boolean
  onOpen: () => void
  loading?: PanelButtonState
  popup?: 'menu' | 'dialog'
}) => {
  const labels = useLocalization()

  const label = action.label(context, labels)
  const ariaLabel = action.ariaLabel?.(context, labels) ?? label
  const active = action.active?.(context)

  const button = (
    <IconButton
      className={action.className?.(context)}
      active={active}
      count={action.count?.(context)}
      label={label}
      aria-label={ariaLabel}
      aria-haspopup={popup}
      aria-expanded={open}
      onClick={onOpen}
      {...panelButtonProps(loading)}
    >
      {action.icon(context)}
    </IconButton>
  )

  const hiddenClass =
    variant === 'row' ? 'row__button--hidden' : 'cell__button--hidden'
  const wrapperBase = variant === 'row' ? 'row__button' : 'cell__button'

  return (
    <div
      className={clsx(wrapperBase, !open && hiddenClass)}
      data-button-active={active || !!loading?.pending}
    >
      <HiddenButtonContext.Provider
        value={!open && !(active || !!loading?.pending)}
      >
        {button}
      </HiddenButtonContext.Provider>
    </div>
  )
}

/** Кебаб схлопнутых действий слота. Base UI-меню грузится лениво. */
export const ActionMenu = ({
  actions,
  context,
  variant = 'cell',
}: Pick<ActionMenuProps, 'actions' | 'context' | 'variant'>) => {
  const labels = useLocalization()
  const menu = useLazyPopover(
    context.table,
    ActionMenuImpl,
    labels => (variant === 'row' ? labels.rowMenu : labels.headerMenu),
    true,
    {
      plugin: variant === 'row' ? 'rowActionMenu' : 'headerActionMenu',
      detail: () => actionDetailOf(context),
    },
  )
  const activeCount = countActiveActions(actions, context)
  const label = variant === 'row' ? labels.rowMenu : labels.headerMenu
  const kebab = useKebabState(
    actions,
    context,
    {
      label,
      ariaLabel: activeCount
        ? labels.withActiveCount(label, activeCount)
        : label,
    },
    menu.open,
    menu.onOpenChange,
  )
  const loading: PanelButtonState = {
    pending: menu.trigger.pending || kebab.running,
    failure: menu.trigger.failure,
    onIntent: kebab.intent,
    onCancel: () => {
      menu.opening.cancel()
      kebab.leave()
    },
  }
  const placeholder = (
    <KebabPlaceholder
      variant={variant}
      activeCount={activeCount}
      active={kebabActive(actions, activeCount)}
      open={menu.open}
      onOpen={() => kebab.openChange(true)}
      loading={loading}
      kebab={kebab}
    />
  )
  if (!menu.ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <ActionMenuImpl.Component
        actions={actions}
        context={context}
        variant={variant}
        open={menu.open}
        onOpenChange={kebab.openChange}
        kebab={kebab}
      />
    </Suspense>
  )
}

/** Инлайн-действие как мини-меню (поповер). Base UI-меню грузится лениво. */
export const ActionInlineMenu = ({
  action,
  context,
  variant = 'cell',
}: Omit<ActionInlineMenuProps, 'open' | 'onOpenChange'>) => {
  const menu = useLazyPopover(
    context.table,
    ActionInlineMenuImpl,
    labels => action.label(context, labels),
    true,
    {
      plugin: actionOwnerOf(action),
      detail: () => ({ ...actionDetailOf(context), action: action.id }),
    },
  )
  const placeholder = (
    <InlinePlaceholder
      action={action}
      context={context}
      variant={variant}
      open={menu.open}
      onOpen={() => menu.onOpenChange(true)}
      loading={loadingOf(menu)}
    />
  )
  if (!menu.ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <ActionInlineMenuImpl.Component
        action={action}
        context={context}
        variant={variant}
        open={menu.open}
        onOpenChange={menu.onOpenChange}
      />
    </Suspense>
  )
}

/**
 * Инлайн-действие с панелью (поповер). Base UI-поповер грузится лениво; поповер
 * открывается, когда готово содержимое панели (`SlotAction.preload`).
 */
export const ActionPanel = ({
  action,
  context,
  variant = 'cell',
}: Omit<ActionPanelProps, 'open' | 'onOpenChange' | 'loading'>) => {
  const [open, setOpen] = useState(false)
  const opening = usePanelOpening(context)
  const onOpenChange = (next: boolean) => {
    if (next)
      opening.request(action, () => setOpen(true), undefined, ActionPanelImpl)
    else {
      opening.cancel()
      setOpen(false)
    }
  }
  const loading: PanelButtonState = {
    pending: opening.pending,
    failure: opening.failure,
    onIntent: () => preloadActionPanel(action, context),
    onCancel: opening.cancel,
  }
  const ready = usePreloaded(ActionPanelImpl)
  const placeholder = (
    <InlinePlaceholder
      action={action}
      context={context}
      variant={variant}
      open={open}
      onOpen={() => onOpenChange(true)}
      loading={loading}
      popup="dialog"
    />
  )
  if (!ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <ActionPanelImpl.Component
        action={action}
        context={context}
        variant={variant}
        open={open}
        onOpenChange={onOpenChange}
        loading={loading}
      />
    </Suspense>
  )
}
