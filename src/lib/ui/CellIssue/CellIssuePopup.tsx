/**
 * Поповер отметки ячейки (ADR 0177, §5): причина и действия. Отдельный чанк — Base UI-поповер
 * тянет позиционирование и хранилища попапов; триггер — обычная кнопка в `CellIssue`.
 */
import { type RefObject, useId } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { Button } from '../Button'
import { POPUP_SIDE_OFFSET } from '../Popup/offset'
import { usePortalThemeClass, usePortalThemeData } from '../theme'
import type { CellIssueAction } from './CellIssue'

import popupStyles from '../Popup/Popup.module.css'
import styles from './CellIssue.module.css'

export interface CellIssuePopupProps {
  anchor: RefObject<HTMLButtonElement | null>
  reason: string
  actions: readonly CellIssueAction[]
  tone: 'error' | 'draft'
  onClose: () => void
}

const CellIssuePopup = ({
  anchor,
  reason,
  actions,
  tone,
  onClose,
}: CellIssuePopupProps) => {
  const reasonId = useId()
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  return (
    <Popover.Root
      open
      onOpenChange={next => {
        if (!next) onClose()
      }}
      modal={false}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={POPUP_SIDE_OFFSET}
          className={clsx(themeClass, popupStyles.positioner)}
          {...themeData}
        >
          <Popover.Popup
            className={clsx(themeClass, popupStyles.popup, styles.popup)}
            finalFocus={anchor}
            aria-labelledby={reasonId}
            data-testid="cell-issue-popover"
          >
            <p id={reasonId} className={styles.reason} data-tone={tone}>
              {reason}
            </p>
            {actions.length > 0 && (
              <div className={styles.actions}>
                {actions.map(action => (
                  <Button
                    key={action.id}
                    variant="ghost"
                    data-action={action.id}
                    onClick={() => {
                      onClose()
                      action.onSelect()
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default CellIssuePopup
