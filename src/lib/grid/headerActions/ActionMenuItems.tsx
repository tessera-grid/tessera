// ActionMenuItems: пункты меню действий грида — модель ядра (`useMenuItemGroups`) в виде
// кита `MenuItems`; кебаб и мини-меню (ADR 0078).
import {
  type MenuItemGroupsOptions,
  useMenuItemGroups,
} from '../../core/headerActions'
import { MenuItems } from '../../ui/Popup/MenuItems'

export type ActionMenuItemsProps = MenuItemGroupsOptions

export const ActionMenuItems = (props: ActionMenuItemsProps) => (
  <MenuItems groups={useMenuItemGroups(props)} />
)
