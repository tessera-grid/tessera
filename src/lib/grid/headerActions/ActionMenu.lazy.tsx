// Ленивая граница кебаб-/инлайн-меню: `@base-ui/react/menu` тянет
// floating-ui-позиционирование, поэтому ActionMenu/ActionInlineMenu живут в
// отдельном чанке. Обёртки эагерные: держат состояние `open` и рисуют
// плейсхолдер-триггер, пока чанк грузится. Клик по плейсхолдеру ставит `open`, а
// контролируемый impl открывается сразу после догрузки — без потери клика. Замену
// плейсхолдера ведёт состояние (`usePreloaded`), а не повтор Suspense-границы: React
// может отложить этот повтор до следующего рендера кнопки, и тогда она сменится
// посреди клика.
import { Suspense, useState } from 'react'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { useLazyPopover } from '../../core/lazyOpening'
import { preloadable, usePreloaded } from '../../core/preloadable'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useIcons } from '../../ui/icons'
import { preloadActionPanel, type SlotAction } from '../../core/headerActions'
import type { ActionMenuProps } from './ActionMenu'
import type { ActionInlineMenuProps } from './ActionInlineMenu'
import type { ActionPanelProps } from './ActionPanel'
import {
  type PanelButtonState,
  panelButtonProps,
  usePanelOpening,
} from './usePanelOpening'

import styles from '../../grid/headerActions/ActionMenu.module.css'
import buttonStyles from '../../grid/headerActions/ActionButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

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
  errorFlash: popover.trigger.errorFlash,
  onIntent: () => {},
  onCancel: popover.opening.cancel,
})

/** Фолбэк кебаб-триггера: тот же IconButton с иконкой ⋮, но без Base UI-обвязки. */
const KebabPlaceholder = ({
  variant,
  open,
  onOpen,
  loading,
}: {
  variant: Variant
  open: boolean
  onOpen: () => void
  loading: PanelButtonState
}) => {
  const { menu: MenuIcon } = useIcons()
  const labels = useLocalization()

  const label = variant === 'row' ? labels.rowMenu : labels.headerMenu
  const trigger = (
    <IconButton
      className={styles.trigger}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onOpen}
      {...panelButtonProps(loading)}
    >
      <MenuIcon width={16} height={16} />
    </IconButton>
  )

  const shown = open || loading.pending
  return (
    <Tooltip title={label}>
      {variant === 'row' ? (
        <div className={clsx('row__button', !shown && 'row__button--hidden')}>
          {trigger}
        </div>
      ) : (
        <div
          className="cell__button cell__button--hidden"
          data-button-active={shown}
        >
          {trigger}
        </div>
      )}
    </Tooltip>
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
  const active = action.active?.(context) ?? false
  const adornment = action.adornment?.(context)

  const button = (
    <IconButton
      className={action.className?.(context)}
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
    <Tooltip title={label}>
      <div
        className={clsx(wrapperBase, !open && hiddenClass)}
        data-button-active={active || !!loading?.pending}
      >
        {adornment ? (
          <span className={buttonStyles.anchor}>
            {button}
            {adornment}
          </span>
        ) : (
          button
        )}
      </div>
    </Tooltip>
  )
}

/** Кебаб схлопнутых действий слота. Base UI-меню грузится лениво. */
export const ActionMenu = ({
  actions,
  context,
  variant = 'cell',
}: Omit<ActionMenuProps, 'open' | 'onOpenChange'>) => {
  const menu = useLazyPopover(context.table, ActionMenuImpl, labels =>
    variant === 'row' ? labels.rowMenu : labels.headerMenu,
  )
  const placeholder = (
    <KebabPlaceholder
      variant={variant}
      open={menu.open}
      onOpen={() => menu.onOpenChange(true)}
      loading={loadingOf(menu)}
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
        onOpenChange={menu.onOpenChange}
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
  const menu = useLazyPopover(context.table, ActionInlineMenuImpl, labels =>
    action.label(context, labels),
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
    errorFlash: opening.errorFlash,
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
