// ActionPanelPopup: поповер действия с панелью (`SlotAction.panel`) — общий для
// инлайн-кнопки и пункта кебаба. Фокус при открытии — на `initialFocusRef` панели,
// при закрытии — на кнопку, открывшую поповер.
import { type RefObject, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { usePortalThemeClass } from '../../core/themeVariables'
import type { ActionPanelControls, SlotAction } from '../../core/headerActions'

import styles from '../../grid/headerActions/ActionPanel.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

interface ActionPanelPopupProps {
  action: SlotAction
  context: any
  /** Кнопка, у которой открыт поповер; на неё возвращается фокус. */
  anchorRef: RefObject<HTMLElement | null>
  close: () => void
}

interface PanelContentProps extends ActionPanelControls {
  panel: NonNullable<SlotAction['panel']>
  context: unknown
}

// Своим компонентом: панель получает ref пропом, а не вызовом во время рендера.
const PanelContent = ({
  panel,
  context,
  close,
  initialFocusRef,
}: PanelContentProps) => panel(context, { close, initialFocusRef })

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
          {action.panel && (
            <PanelContent
              panel={action.panel}
              context={context}
              close={close}
              initialFocusRef={initialFocusRef}
            />
          )}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}
