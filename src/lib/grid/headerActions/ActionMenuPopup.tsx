// ActionMenuPopup: тело меню действий (Base UI portal + popup). Каждое действие —
// подгруппа (menuItems или одна строка). Общая часть кебаба (ActionMenu) и
// инлайн-поповера (ActionInlineMenu).
import { Menu } from '@base-ui/react/menu'
import { Check } from 'lucide-react'
import clsx from 'clsx'

import { usePortalThemeClass } from '../../core/themeVariables'
import { useLocalization } from '../../core/localization'
import {
  type SlotAction,
  preloadActionPanel,
  menuGroups,
} from '../../core/headerActions'

import styles from '../../grid/headerActions/ActionMenu.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

interface ActionMenuPopupProps {
  actions: SlotAction[]
  context: unknown
  /** Пункт действия с панелью открывает её вместо `onSelect`. */
  onOpenPanel?: (action: SlotAction) => void
  /** Куда вернуть фокус при закрытии (Base UI `finalFocus`). */
  finalFocus?: () => boolean
}

export const ActionMenuPopup = ({
  actions,
  context,
  onOpenPanel,
  finalFocus,
}: ActionMenuPopupProps) => {
  const themeClass = usePortalThemeClass()
  const labels = useLocalization()

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
          {menuGroups(actions, context, labels).map(
            ({ action, items, groupLabel, divided }) => {
              const preload = action.preload
                ? () => preloadActionPanel(action, context)
                : undefined

              return (
                <Menu.Group
                  key={action.id}
                  className={clsx(styles.group, divided && styles.divided)}
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
                      closeOnClick={!(action.panel && onOpenPanel)}
                      onClick={
                        action.panel && onOpenPanel
                          ? () => onOpenPanel(action)
                          : item.onSelect
                      }
                      onPointerEnter={preload}
                      onFocus={preload}
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
            },
          )}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}
