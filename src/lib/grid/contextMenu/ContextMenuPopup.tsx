// ContextMenuPopup: тело контекстного меню (Base UI Menu, контролируемый open,
// виртуальный якорь у курсора). Грузится лениво (Base UI тянет floating-ui) —
// монтируется только когда меню открыто. Переиспользует движок пунктов
// (ActionMenuItems) и стили кебаба (ActionMenu.module.css). ADR 0030.
import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { usePortalThemeData, usePortalThemeClass } from '../../ui/theme'
import type { TableLabels } from '../../core/localization'
import type {
  ContextMenuAction,
  ContextMenuContext,
} from '../../core/headerActions'
import type { ActionMenuItemsProps } from '../headerActions/ActionMenuItems'
import { ActionMenuSections } from '../headerActions/ActionMenuSections'
import { useCloseOnGridScroll } from '../headerActions/useCloseOnGridScroll'
import { GRID_SCROLL_REASON, useMenuLeave } from '../headerActions/useMenuLeave'
import { useMenuSections } from '../headerActions/useMenuSections'

import menuStyles from '../headerActions/ActionMenu.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

export interface ContextMenuPopupProps {
  /** Координаты курсора (виртуальный якорь позиционера). */
  x: number
  y: number
  actions: ContextMenuAction[]
  context: ContextMenuContext
  labels: TableLabels
  /** Сессия проверки доступности (ADR 0078). */
  session?: ActionMenuItemsProps['session']
  /** Проверить пункты вошедшего раздела в сессии (ADR 0079). */
  extendChecks?: (actions: ActionMenuItemsProps['actions']) => void
  onClose: () => void
}

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
              sections.depth > 0 ? sections.level.title : labels.contextMenu
            }
            className={clsx(themeClass, menuStyles.popup)}
            finalFocus={leave.returnFocus}
          >
            <ActionMenuSections
              sections={sections}
              context={context}
              session={session}
              close={onClose}
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
