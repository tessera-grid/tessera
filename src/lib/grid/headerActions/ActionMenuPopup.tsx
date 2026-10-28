// ActionMenuPopup: тело меню действий (Base UI portal + popup). Общая часть кебаба
// (ActionMenu) и инлайн-поповера (ActionInlineMenu); пункты — ActionMenuItems.
import type { Ref } from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import {
  usePortalThemeData,
  usePortalThemeClass,
} from '../../core/themeVariables'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuItems, type ActionMenuItemsProps } from './ActionMenuItems'
import { ActionMenuSections } from './ActionMenuSections'
import type { MenuSections } from './useMenuSections'

import styles from '../../grid/headerActions/ActionMenu.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

interface ActionMenuPopupProps {
  actions: SlotAction[]
  context: unknown
  /** Сессия проверки доступности (ADR 0078). */
  session?: ActionMenuItemsProps['session']
  /** Закрыть меню после повторной проверки, разрешившей действие. */
  close?: () => void
  /** Пункт действия с панелью открывает её вместо `onSelect`. */
  onOpenPanel?: (action: SlotAction) => void
  /** Разделы меню (ADR 0079); без них — один уровень. */
  sections?: MenuSections
  /** Куда вернуть фокус при закрытии (Base UI `finalFocus`). */
  finalFocus?: () => boolean
  popupRef?: Ref<HTMLDivElement>
}

export const ActionMenuPopup = ({
  actions,
  context,
  session,
  close,
  onOpenPanel,
  sections,
  finalFocus,
  popupRef,
}: ActionMenuPopupProps) => {
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()

  return (
    <Menu.Portal>
      <Menu.Positioner
        side="bottom"
        align="end"
        sideOffset={POPUP_SIDE_OFFSET}
        className={clsx(themeClass, styles.positioner)}
        {...themeData}
      >
        <Menu.Popup
          ref={popupRef}
          className={clsx(themeClass, styles.popup)}
          finalFocus={finalFocus}
          aria-label={
            sections && sections.depth > 0 ? sections.level.title : undefined
          }
        >
          {sections ? (
            <ActionMenuSections
              sections={sections}
              context={context}
              session={session}
              close={close}
              onOpenPanel={onOpenPanel}
            />
          ) : (
            <ActionMenuItems
              actions={actions}
              context={context}
              session={session}
              close={close}
              onOpenPanel={onOpenPanel}
            />
          )}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}
