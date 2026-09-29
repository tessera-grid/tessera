// Ленивая граница кебаб-/инлайн-меню: `@base-ui/react/menu` тянет
// floating-ui-позиционирование, поэтому ActionMenu/ActionInlineMenu живут в
// отдельном чанке. Обёртки эагерные: держат состояние `open` и рисуют
// плейсхолдер-триггер, пока чанк грузится. Клик по плейсхолдеру ставит `open`, а
// контролируемый impl открывается сразу после догрузки — без потери клика.
import { lazy, Suspense, useState } from 'react'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import type { SlotAction } from '../../core/headerActions'
import type { ActionMenuProps } from './ActionMenu'
import type { ActionInlineMenuProps } from './ActionInlineMenu'

import styles from '../../grid/headerActions/ActionMenu.module.css'
import buttonStyles from '../../grid/headerActions/ActionButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

const ActionMenuImpl = lazy(() =>
  import('./ActionMenu').then(m => ({ default: m.ActionMenu })),
)

const ActionInlineMenuImpl = lazy(() =>
  import('./ActionInlineMenu').then(m => ({ default: m.ActionInlineMenu })),
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
}: {
  action: SlotAction
  context: any
  variant: Variant
  open: boolean
  onOpen: () => void
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
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onOpen}
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
      data-button-active={active}
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

  return (
    <Suspense
      fallback={
        <KebabPlaceholder
          variant={variant}
          open={open}
          onOpen={() => setOpen(true)}
        />
      }
    >
      <ActionMenuImpl
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

  return (
    <Suspense
      fallback={
        <InlinePlaceholder
          action={action}
          context={context}
          variant={variant}
          open={open}
          onOpen={() => setOpen(true)}
        />
      }
    >
      <ActionInlineMenuImpl
        action={action}
        context={context}
        variant={variant}
        open={open}
        onOpenChange={setOpen}
      />
    </Suspense>
  )
}
