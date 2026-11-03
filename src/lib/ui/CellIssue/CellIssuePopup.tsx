/**
 * Поповер отметки ячейки (ADR 0177, §5; ADR 0178, §6): один на отказ, ошибку данных и черновик —
 * заголовок, тело обычным текстом, под разделителем — кнопки справа. Отдельный чанк —
 * Base UI-поповер тянет позиционирование и хранилища попапов; триггер — обычная кнопка в
 * `CellIssue`.
 */
import { type RefObject, useId } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { Button } from '../Button'
import { POPUP_SIDE_OFFSET } from '../Popup/offset'
import { usePortalThemeClass, usePortalThemeData } from '../theme'
import type { CellIssueAction, CellIssueDetail } from './CellIssue'

import popupStyles from '../Popup/Popup.module.css'
import styles from './CellIssue.module.css'

export interface CellIssuePopupProps {
  anchor: RefObject<HTMLButtonElement | null>
  title: string
  reason: string
  details?: readonly CellIssueDetail[]
  actions: readonly CellIssueAction[]
  tone: 'error' | 'draft'
  onClose: () => void
}

const CellIssuePopup = ({
  anchor,
  title,
  reason,
  details,
  actions,
  tone,
  onClose,
}: CellIssuePopupProps) => {
  const titleId = useId()
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  // Главное действие — последним, справа.
  const ordered = [
    ...actions.filter(action => !action.primary),
    ...actions.filter(action => action.primary),
  ]
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
            aria-labelledby={titleId}
            data-testid="cell-issue-popover"
            data-tone={tone}
          >
            <p id={titleId} className={styles.title}>
              {title}
            </p>
            {details && details.length > 0 ? (
              <dl className={styles.details}>
                {details.map(detail => (
                  <div key={detail.label} className={styles.detail}>
                    <dt>{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.reason}>{reason}</p>
            )}
            {ordered.length > 0 && (
              <div className={styles.actions}>
                {ordered.map(action => (
                  <Button
                    key={action.id}
                    variant={action.primary ? 'outline' : 'ghost'}
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
