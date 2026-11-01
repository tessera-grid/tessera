// HandleMenuPopup: меню команд у ручки — вид (Base UI Menu, контролируемый open, якорь —
// сама ручка). Грузится лениво (Base UI тянет floating-ui) — монтируется только
// открытым. Стили — общие с меню действий. ADR 0034, ADR 0168.
import type { MouseEvent, RefObject } from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import type { HandleMenuItemModel } from '../../util/menuModel'
import { usePortalThemeData, usePortalThemeClass } from '../theme'
import { useCloseOnGridScroll } from './useCloseOnGridScroll'
import { GRID_SCROLL_REASON, useMenuLeave } from './useMenuLeave'

import menuStyles from './ActionMenu.module.css'
import { POPUP_SIDE_OFFSET } from './offset'

export interface HandleMenuPopupProps {
  anchor: RefObject<HTMLElement | null>
  /** Куда вернуть фокус при закрытии; по умолчанию — якорь. */
  focusTarget?: RefObject<HTMLElement | null>
  label: string
  items: HandleMenuItemModel[]
  onClose: () => void
  /** Пункт выбран — до его обработчика (канал действий, ADR 0125). */
  onItemSelect?: (id: string, event: MouseEvent) => void
}

export const HandleMenuPopup = ({
  anchor,
  focusTarget = anchor,
  label,
  items,
  onClose,
  onItemSelect,
}: HandleMenuPopupProps) => {
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  const leave = useMenuLeave()
  useCloseOnGridScroll(true, () => {
    leave.track(false, GRID_SCROLL_REASON)
    onClose()
  })
  return (
    <Menu.Root
      modal={false}
      open
      onOpenChange={(open, details) => {
        leave.track(open, details.reason)
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
          {...themeData}
        >
          <Menu.Popup
            aria-label={label}
            finalFocus={() =>
              leave.returnFocus() && (focusTarget.current ?? true)
            }
            className={clsx(themeClass, menuStyles.popup)}
          >
            <Menu.Group className={menuStyles.group}>
              {items.map(item => (
                <Menu.Item
                  key={item.id}
                  className={menuStyles.item}
                  disabled={item.disabled}
                  label={item.label}
                  data-item-id={item.id}
                  onClick={event => {
                    onItemSelect?.(item.id, event)
                    item.onSelect()
                  }}
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
