// ActionPanelPopup: поповер действия с панелью (`SlotAction.panel`) — общий для
// инлайн-кнопки и пункта кебаба. Фокус при открытии — на `initialFocusRef` панели,
// при закрытии — на кнопку, открывшую поповер.
import { type RefObject, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'

import { useLocalization } from '../../core/localization'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import type { ActionPanelControls, SlotAction } from '../../core/headerActions'

import styles from '../../grid/headerActions/ActionPanel.module.css'
import { useFinalFocus } from '../../ui/Popup/finalFocus'
import { menuActionLabel } from '../../core/actions'

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
  const labels = useLocalization()
  const initialFocusRef = useRef<HTMLElement | null>(null)
  const { popupRef, finalFocus } = useFinalFocus(anchorRef)

  return (
    <Popover.Portal>
      <PopupSurface
        positioner={
          <Popover.Positioner anchor={anchorRef} side="bottom" align="end" />
        }
        popup={
          <Popover.Popup
            aria-label={menuActionLabel(action, context, labels)}
            initialFocus={() => initialFocusRef.current ?? true}
            ref={popupRef}
            finalFocus={finalFocus}
            data-action-panel={action.id}
          />
        }
        className={styles.popup}
      >
        {action.panel && (
          <PanelContent
            panel={action.panel}
            context={context}
            close={close}
            initialFocusRef={initialFocusRef}
          />
        )}
      </PopupSurface>
    </Popover.Portal>
  )
}
