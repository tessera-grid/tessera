// Cutover (grid) — v9-порт ActionInlineMenu: инлайн-действие как мини-меню
// (поповер) — сама иконка-кнопка служит триггером, раскрывая menuItems тем же
// телом, что и кебаб. Применяется при неоднозначном инлайн-клике (закрепление при
// обеих сторонах, inlineAsMenu). useSubscribeStore убран (реактивность — ActionsZone).
import { useState } from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { useLocalization } from '../../../lib/core/localization'
import { IconButton } from '../../../lib/ui/IconButton'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuPopup } from './ActionMenuPopup'

import buttonStyles from '../../../lib/grid/headerActions/ActionButton.module.css'
import '../../../lib/grid/cellControls/buttonVisibility.css'

interface ActionInlineMenuProps {
  action: SlotAction
  context: any
  variant?: 'cell' | 'row'
}

export const ActionInlineMenu = ({
  action,
  context,
  variant = 'cell',
}: ActionInlineMenuProps) => {
  const labels = useLocalization()

  const [open, setOpen] = useState(false)

  const label = action.label(context, labels)
  const ariaLabel = action.ariaLabel?.(context, labels) ?? label
  const active = action.active?.(context) ?? false
  const adornment = action.adornment?.(context)

  const button = (
    <Menu.Trigger
      render={
        <IconButton className={action.className?.(context)} aria-label={ariaLabel}>
          {action.icon(context)}
        </IconButton>
      }
    />
  )

  const hiddenClass =
    variant === 'row' ? 'row__button--hidden' : 'cell__button--hidden'
  const wrapperBase = variant === 'row' ? 'row__button' : 'cell__button'

  return (
    <Menu.Root onOpenChange={setOpen}>
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
