// ContextMenuPopup: тело контекстного меню (Base UI Menu, контролируемый open,
// виртуальный якорь у курсора). Грузится лениво (Base UI тянет floating-ui) —
// монтируется только когда меню открыто. Пункты и разделы — модель ядра в виде кита,
// как у кебаба (ActionMenu.module.css). ADR 0030.
import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { usePortalThemeData, usePortalThemeClass } from '../../ui/theme'
import { sourceOf } from '../../core/debugActions'
import type { TableLabels } from '../../core/localization'
import {
  type ContextMenuAction,
  type ContextMenuContext,
  type MenuItemGroupsOptions,
  useMenuItemGroups,
  useMenuSections,
} from '../../core/headerActions'
import { MenuItems } from '../../ui/Popup/MenuItems'
import { MenuSections } from '../../ui/Popup/MenuSections'
import { useCloseOnGridScroll } from '../../ui/Popup/useCloseOnGridScroll'
import { GRID_SCROLL_REASON, useMenuLeave } from '../../ui/Popup/useMenuLeave'

import menuStyles from '../../ui/Popup/ActionMenu.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { contextMenuLabels } from './labels'

export interface ContextMenuPopupProps {
  /** Координаты курсора (виртуальный якорь позиционера). */
  x: number
  y: number
  actions: ContextMenuAction[]
  context: ContextMenuContext
  labels: TableLabels
  /** Сессия проверки доступности (ADR 0078). */
  session?: MenuItemGroupsOptions['session']
  /** Проверить пункты вошедшего раздела в сессии (ADR 0079). */
  extendChecks?: (actions: MenuItemGroupsOptions['actions']) => void
  onClose: () => void
}

const ContextMenuItems = (props: MenuItemGroupsOptions) => (
  <MenuItems groups={useMenuItemGroups(props)} />
)

export const ContextMenuPopup = ({
  x,
  y,
  actions,
  context,
  labels,
  session,
  extendChecks,
  onClose,
}: ContextMenuPopupProps) => {
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  const sections = useMenuSections(
    actions,
    context,
    labels,
    undefined,
    extendChecks,
  )
  const leave = useMenuLeave()
  useCloseOnGridScroll(true, () => {
    leave.track(false, GRID_SCROLL_REASON)
    onClose()
  })
  // Виртуальный якорь — точка курсора (нулевой прямоугольник у координат).
  const anchor = { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) }

  return (
    <Menu.Root
      modal={false}
      open
      onOpenChange={(open, details) => {
        leave.track(open, details.reason)
        // Escape в разделе — уровень выше, а не закрытие (ADR 0079).
        if (!open && details.reason === 'escape-key' && sections.back()) return
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
          {...themeData}
        >
          <Menu.Popup
            aria-label={
              sections.depth > 0
                ? sections.level.title
                : contextMenuLabels(labels).contextMenu
            }
            className={clsx(themeClass, menuStyles.popup)}
            finalFocus={leave.returnFocus}
          >
            <MenuSections
              sections={sections}
              backLabel={labels.menuBack(sections.level.title ?? '')}
              failedLabel={labels.sectionLoadFailed}
              onBack={event => sections.back(sourceOf(event))}
            >
              {(items, closeOnSelect) => (
                <ContextMenuItems
                  actions={items}
                  context={context}
                  session={session}
                  close={onClose}
                  sections={sections}
                  closeOnSelect={closeOnSelect}
                />
              )}
            </MenuSections>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
