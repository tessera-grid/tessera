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
import { preloadable, usePreloaded } from '../../core/preloadable'
import { IconButton } from '../../ui/IconButton'
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

/** Фолбэк кебаб-триггера: тот же IconButton с иконкой ⋮, но без Base UI-обвязки. */
const KebabPlaceholder = ({
  variant,
  open,
  onOpen,
}: {
  variant: Variant
  open: boolean
  onOpen: () => void
}) => {
  const { menu: MenuIcon } = useIcons()
  const labels = useLocalization()

  const trigger = (
    <IconButton
      className={styles.trigger}
      aria-label={labels.headerMenu}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onOpen}
    >
      <MenuIcon width={16} height={16} />
    </IconButton>
  )

  return variant === 'row' ? (
    <div className={clsx('row__button', !open && 'row__button--hidden')}>
      {trigger}
    </div>
  ) : (
    <div
      className="cell__button cell__button--hidden"
      data-button-active={open}
    >
      {trigger}
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

  const ariaLabel =
    action.ariaLabel?.(context, labels) ?? action.label(context, labels)
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
  )
}

/** Кебаб схлопнутых действий слота. Base UI-меню грузится лениво. */
export const ActionMenu = ({
  actions,
  context,
  variant = 'cell',
}: Omit<ActionMenuProps, 'open' | 'onOpenChange'>) => {
  const [open, setOpen] = useState(false)
  const ready = usePreloaded(ActionMenuImpl)
  const placeholder = (
    <KebabPlaceholder
      variant={variant}
      open={open}
      onOpen={() => setOpen(true)}
    />
  )
  if (!ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <ActionMenuImpl.Component
        actions={actions}
        context={context}
        variant={variant}
        open={open}
        onOpenChange={setOpen}
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
  const [open, setOpen] = useState(false)
  const ready = usePreloaded(ActionInlineMenuImpl)
  const placeholder = (
    <InlinePlaceholder
      action={action}
      context={context}
      variant={variant}
      open={open}
      onOpen={() => setOpen(true)}
    />
  )
  if (!ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <ActionInlineMenuImpl.Component
        action={action}
        context={context}
        variant={variant}
        open={open}
        onOpenChange={setOpen}
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
    if (next) opening.request(action, () => setOpen(true))
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
