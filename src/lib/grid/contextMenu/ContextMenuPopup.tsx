// ContextMenuPopup: тело контекстного меню (Base UI Menu, контролируемый open,
// виртуальный якорь у курсора). Грузится лениво (Base UI тянет floating-ui) —
// монтируется только когда меню открыто. Переиспользует движок пунктов
// (ActionMenuItems) и стили кебаба (ActionMenu.module.css). ADR 0030.
import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { usePortalThemeClass } from '../../core/themeVariables'
import type { TableLabels } from '../../core/localization'
import type {
  ContextMenuAction,
  ContextMenuContext,
} from '../../core/headerActions'
import {
  ActionMenuItems,
  type ActionMenuItemsProps,
} from '../headerActions/ActionMenuItems'

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
  onClose: () => void
}

export const ContextMenuPopup = ({
  x,
  y,
  actions,
  context,
  labels,
  session,
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
            <ActionMenuItems
              actions={actions}
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
