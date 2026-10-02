// ActionPanelPopup: поповер действия с панелью (`SlotAction.panel`) — общий для
// инлайн-кнопки и пункта кебаба. Фокус при открытии — на `initialFocusRef` панели,
// при закрытии — на кнопку, открывшую поповер.
import { type RefObject, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { usePortalThemeClass } from '../../core/themeVariables'
import type { SlotAction } from '../../core/headerActions'

import styles from '../../grid/headerActions/ActionPanel.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

interface ActionPanelPopupProps {
  action: SlotAction
  context: any
  /** Кнопка, у которой открыт поповер; на неё возвращается фокус. */
  anchorRef: RefObject<HTMLElement | null>
  close: () => void
}

export const ActionPanelPopup = ({
  action,
  context,
  anchorRef,
  close,
}: ActionPanelPopupProps) => {
  const themeClass = usePortalThemeClass()
  const labels = useLocalization()
  const initialFocusRef = useRef<HTMLElement | null>(null)

  return (
    <Popover.Portal>
      <Popover.Positioner
        anchor={anchorRef}
        side="bottom"
        align="end"
        sideOffset={POPUP_SIDE_OFFSET}
        className={clsx(themeClass, styles.positioner)}
      >
        <Popover.Popup
          aria-label={action.label(context, labels)}
          initialFocus={() => initialFocusRef.current ?? true}
          finalFocus={anchorRef}
          className={clsx(themeClass, styles.popup)}
          data-action-panel={action.id}
        >
          {action.panel?.(context, { close, initialFocusRef })}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}
