// ActionMenuPopup: тело меню действий (Base UI portal + popup). Общая часть кебаба
// (ActionMenu) и инлайн-поповера (ActionInlineMenu); пункты — ActionMenuItems.
import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { usePortalThemeClass } from '../../core/themeVariables'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuItems, type ActionMenuItemsProps } from './ActionMenuItems'

import styles from '../../grid/headerActions/ActionMenu.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

interface ActionMenuPopupProps {
  actions: SlotAction[]
  context: unknown
  /** Сессия проверки доступности (ADR 0078). */
  session?: ActionMenuItemsProps['session']
  /** Закрыть меню после повторной проверки, разрешившей действие. */
  close?: () => void
  /** Пункт действия с панелью открывает её вместо `onSelect`. */
  onOpenPanel?: (action: SlotAction) => void
  /** Куда вернуть фокус при закрытии (Base UI `finalFocus`). */
  finalFocus?: () => boolean
}

export const ActionMenuPopup = ({
  actions,
  context,
  session,
  close,
  onOpenPanel,
  finalFocus,
}: ActionMenuPopupProps) => {
  const themeClass = usePortalThemeClass()

  return (
    <Menu.Portal>
      <Menu.Positioner
        side="bottom"
        align="end"
        sideOffset={POPUP_SIDE_OFFSET}
        className={clsx(themeClass, styles.positioner)}
      >
        <Menu.Popup
          className={clsx(themeClass, styles.popup)}
          finalFocus={finalFocus}
        >
          <ActionMenuItems
            actions={actions}
            context={context}
            session={session}
            close={close}
            onOpenPanel={onOpenPanel}
          />
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}
