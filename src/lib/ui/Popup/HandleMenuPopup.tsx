// HandleMenuPopup: меню команд у ручки — вид (Base UI Menu, контролируемый open, якорь —
// сама ручка). Грузится лениво (Base UI тянет floating-ui) — монтируется только
// открытым. Стили — общие с меню действий. ADR 0034, ADR 0168.
import type { MouseEvent, RefObject } from 'react'

import { Menu } from '@base-ui/react/menu'

import type { HandleMenuItemModel } from '../../util/menuModel'
import { PopupGroup } from './PopupGroup'
import { PopupItem } from './PopupItem'
import { PopupSurface } from './PopupSurface'
import { useCloseOnGridScroll } from './useCloseOnGridScroll'
import { GRID_SCROLL_REASON, useMenuLeave } from './useMenuLeave'

import menuStyles from './ActionMenu.module.css'

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
        <PopupSurface
          positioner={
            <Menu.Positioner anchor={anchor} side="bottom" align="start" />
          }
          popup={
            <Menu.Popup
              aria-label={label}
              finalFocus={() =>
                leave.returnFocus() && (focusTarget.current ?? true)
              }
            />
          }
          className={menuStyles.popup}
        >
          <PopupGroup render={<Menu.Group />}>
            {items.map(item => (
              <PopupItem
                key={item.id}
                wrap
                render={
                  <Menu.Item
                    disabled={item.disabled}
                    label={item.label}
                    onClick={event => {
                      onItemSelect?.(item.id, event)
                      item.onSelect()
                    }}
                  />
                }
                data-item-id={item.id}
                label={item.label}
              />
            ))}
          </PopupGroup>
        </PopupSurface>
      </Menu.Portal>
    </Menu.Root>
  )
}
