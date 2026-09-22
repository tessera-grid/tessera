// ContextMenuPopup: тело контекстного меню (Base UI Menu, контролируемый open,
// виртуальный якорь у курсора). Грузится лениво (Base UI тянет floating-ui) —
// монтируется только когда меню открыто. Переиспользует движок пунктов
// (resolveMenuItems) и стили кебаба (ActionMenu.module.css). ADR 0030.
import { Menu } from '@base-ui/react/menu'
import { Check } from 'lucide-react'
import clsx from 'clsx'

import { DATA_GRID_THEME_CLASS } from '../../core/themeVariables'
import type { TableLabels } from '../../core/localization'
import {
  resolveMenuItems,
  type ContextMenuAction,
  type ContextMenuContext,
} from '../../core/headerActions'

import menuStyles from '../headerActions/ActionMenu.module.css'

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
          sideOffset={2}
          className={clsx(DATA_GRID_THEME_CLASS, menuStyles.positioner)}
        >
          <Menu.Popup
            aria-label={labels.contextMenu}
            className={clsx(DATA_GRID_THEME_CLASS, menuStyles.popup)}
          >
            {actions.map((action, index) => {
              const items = resolveMenuItems(action, context, labels)
              const groupLabel = action.menuGroupLabel?.(labels)

              return (
                <Menu.Group
                  key={action.id}
                  className={clsx(
                    menuStyles.group,
                    index > 0 && menuStyles.divided,
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
                      <span className={menuStyles.itemLabel}>{item.label}</span>
                      <span className={menuStyles.itemCheck} aria-hidden>
                        {item.active && <Check width={14} height={14} />}
                      </span>
                    </Menu.Item>
                  ))}
                </Menu.Group>
              )
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
