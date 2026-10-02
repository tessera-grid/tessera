// HandleMenuPopup: меню команд у ручки (Base UI Menu, контролируемый open, якорь —
// сама ручка). Грузится лениво (Base UI тянет floating-ui) — монтируется только
// открытым. Стили — общие с меню действий. ADR 0034.
import type { RefObject } from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { usePortalThemeClass } from '../../core/themeVariables'
import type { HeaderMenuItem } from '../../core/headerActions'

import menuStyles from '../headerActions/ActionMenu.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

export interface HandleMenuPopupProps {
  anchor: RefObject<HTMLElement | null>
  /** Куда вернуть фокус при закрытии; по умолчанию — якорь. */
  focusTarget?: RefObject<HTMLElement | null>
  label: string
  items: HeaderMenuItem[]
  onClose: () => void
}

export const HandleMenuPopup = ({
  anchor,
  focusTarget = anchor,
  label,
  items,
  onClose,
}: HandleMenuPopupProps) => {
  const themeClass = usePortalThemeClass()
  return (
    <Menu.Root
      open
      onOpenChange={open => {
        if (!open) {
          onClose()
        }
      }}
    >
      <Menu.Portal>
        <Menu.Positioner
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={POPUP_SIDE_OFFSET}
          className={clsx(themeClass, menuStyles.positioner)}
        >
          <Menu.Popup
            aria-label={label}
            finalFocus={focusTarget}
            className={clsx(themeClass, menuStyles.popup)}
          >
            <Menu.Group className={menuStyles.group}>
              {items.map(item => (
                <Menu.Item
                  key={item.id}
                  className={menuStyles.item}
                  disabled={item.disabled}
                  label={item.label}
                  onClick={item.onSelect}
                >
                  <span className={menuStyles.itemLabel}>{item.label}</span>
                </Menu.Item>
              ))}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
