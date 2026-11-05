// ActionMenuPopup: тело меню действий (Base UI portal + popup). Общая часть кебаба
// (ActionMenu) и инлайн-поповера (ActionInlineMenu); пункты — ActionMenuItems.
import type { Ref } from 'react'

import { Menu } from '@base-ui/react/menu'

import { PopupSurface } from '../../ui/Popup/PopupSurface'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuItems, type ActionMenuItemsProps } from './ActionMenuItems'
import { ActionMenuSections } from './ActionMenuSections'
import type { MenuSections } from '../../core/headerActions'

import styles from '../../ui/Popup/ActionMenu.module.css'

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
  return (
    <Menu.Portal>
      <PopupSurface
        positioner={<Menu.Positioner side="bottom" align="end" />}
        popup={
          <Menu.Popup
            ref={popupRef}
            finalFocus={finalFocus}
            aria-label={
              sections && sections.depth > 0 ? sections.level.title : undefined
            }
          />
        }
        className={styles.popup}
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
      </PopupSurface>
    </Menu.Portal>
  )
}
