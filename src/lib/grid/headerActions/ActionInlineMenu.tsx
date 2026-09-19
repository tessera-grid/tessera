// ActionInlineMenu: инлайн-действие как мини-меню (поповер) — сама иконка-кнопка
// служит триггером, раскрывая menuItems тем же телом, что и кебаб. Применяется при
// неоднозначном инлайн-клике (закрепление при обеих сторонах, inlineAsMenu).
import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuPopup } from './ActionMenuPopup'

import buttonStyles from '../../grid/headerActions/ActionButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

export interface ActionInlineMenuProps {
  action: SlotAction
  context: any
  variant?: 'cell' | 'row'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ActionInlineMenu = ({
  action,
  context,
  variant = 'cell',
  open,
  onOpenChange,
}: ActionInlineMenuProps) => {
  const labels = useLocalization()

  const label = action.label(context, labels)
  const ariaLabel = action.ariaLabel?.(context, labels) ?? label
  const active = action.active?.(context) ?? false
  const adornment = action.adornment?.(context)

  const button = (
    <Menu.Trigger
      render={
        <IconButton
          className={action.className?.(context)}
          aria-label={ariaLabel}
        >
          {action.icon(context)}
        </IconButton>
      }
    />
  )

  const hiddenClass =
    variant === 'row' ? 'row__button--hidden' : 'cell__button--hidden'
  const wrapperBase = variant === 'row' ? 'row__button' : 'cell__button'

  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
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
      <ActionMenuPopup actions={[action]} context={context} />
    </Menu.Root>
  )
}

ActionInlineMenu.displayName = 'ActionInlineMenu'
