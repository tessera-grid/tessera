// Cutover (grid) — v9-порт ActionMenuPopup: тело меню действий (Base UI portal +
// popup). Каждое действие — подгруппа (menuItems или одна строка). Общая часть
// кебаба (ActionMenu) и инлайн-поповера (ActionInlineMenu).
import { Menu } from '@base-ui/react/menu'
import { Check } from 'lucide-react'
import clsx from 'clsx'

import { DATA_GRID_THEME_CLASS } from '../../core/themeVariables'
import { useLocalization } from '../../core/localization'
import { type SlotAction, resolveMenuItems } from '../../core/headerActions'

import styles from '../../grid/headerActions/ActionMenu.module.css'

interface ActionMenuPopupProps {
  actions: SlotAction[]
  context: unknown
}

export const ActionMenuPopup = ({ actions, context }: ActionMenuPopupProps) => {
  const labels = useLocalization()

  return (
    <Menu.Portal>
      <Menu.Positioner
        side="bottom"
        align="end"
        sideOffset={4}
        className={clsx(DATA_GRID_THEME_CLASS, styles.positioner)}
      >
        <Menu.Popup className={clsx(DATA_GRID_THEME_CLASS, styles.popup)}>
          {actions.map((action, index) => {
            const items = resolveMenuItems(action, context, labels)
            const groupLabel = action.menuGroupLabel?.(labels)

            return (
              <Menu.Group
                key={action.id}
                className={clsx(styles.group, index > 0 && styles.divided)}
              >
                {groupLabel && (
                  <Menu.GroupLabel className={styles.groupLabel}>
                    {groupLabel}
                  </Menu.GroupLabel>
                )}
                {items.map(item => (
                  <Menu.Item
                    key={item.id}
                    className={styles.item}
                    disabled={item.disabled}
                    label={item.label}
                    onClick={item.onSelect}
                  >
                    <span className={styles.itemIcon} aria-hidden>
                      {item.icon}
                    </span>
                    <span className={styles.itemLabel}>{item.label}</span>
                    <span className={styles.itemCheck} aria-hidden>
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
  )
}
