// ContextMenuPopup: тело контекстного меню (Base UI Menu, контролируемый open,
// виртуальный якорь у курсора). Грузится лениво (Base UI тянет floating-ui) —
// монтируется только когда меню открыто. Переиспользует движок пунктов
// (resolveMenuItems) и стили кебаба (ActionMenu.module.css). ADR 0030.
import { Menu } from '@base-ui/react/menu'
import { Check } from 'lucide-react'
import clsx from 'clsx'

import { usePortalThemeClass } from '../../core/themeVariables'
import type { TableLabels } from '../../core/localization'
import {
  menuGroups,
  type ContextMenuAction,
  type ContextMenuContext,
} from '../../core/headerActions'

import menuStyles from '../headerActions/ActionMenu.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

export interface ContextMenuPopupProps {
  /** Координаты курсора (виртуальный якорь позиционера). */
  x: number
  y: number
  actions: ContextMenuAction[]
  context: ContextMenuContext
  labels: TableLabels
  onClose: () => void
}

export const ContextMenuPopup = ({
  x,
  y,
  actions,
  context,
  labels,
  onClose,
}: ContextMenuPopupProps) => {
  const themeClass = usePortalThemeClass()
  // Виртуальный якорь — точка курсора (нулевой прямоугольник у координат).
  const anchor = { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) }

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
          side="right"
          align="start"
          sideOffset={POPUP_SIDE_OFFSET}
          className={clsx(themeClass, menuStyles.positioner)}
        >
          <Menu.Popup
            aria-label={labels.contextMenu}
            className={clsx(themeClass, menuStyles.popup)}
          >
            {menuGroups(actions, context, labels).map(
              ({ action, items, groupLabel, divided }) => {
                return (
                  <Menu.Group
                    key={action.id}
                    className={clsx(
                      menuStyles.group,
                      divided && menuStyles.divided,
                    )}
                  >
                    {groupLabel && (
                      <Menu.GroupLabel className={menuStyles.groupLabel}>
                        {groupLabel}
                      </Menu.GroupLabel>
                    )}
                    {items.map(item => (
                      <Menu.Item
                        key={item.id}
                        className={menuStyles.item}
                        disabled={item.disabled}
                        label={item.label}
                        onClick={item.onSelect}
                      >
                        <span className={menuStyles.itemIcon} aria-hidden>
                          {item.icon}
                        </span>
                        <span className={menuStyles.itemLabel}>
                          {item.label}
                        </span>
                        <span className={menuStyles.itemCheck} aria-hidden>
                          {item.active && <Check width={14} height={14} />}
                        </span>
                      </Menu.Item>
                    ))}
                  </Menu.Group>
                )
              },
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
