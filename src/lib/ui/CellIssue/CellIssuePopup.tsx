/**
 * Поповер отметки ячейки (ADR 0177, §5; ADR 0178, §6): один на отказ, ошибку данных и черновик —
 * заголовок, тело обычным текстом, внизу — кнопки справа (поповер-панель, ADR 0183). Отдельный чанк —
 * Base UI-поповер тянет позиционирование и хранилища попапов; триггер — обычная кнопка в
 * `CellIssue`.
 */
import { type RefObject, useId } from 'react'

import { Popover } from '@base-ui/react/popover'

import { Button } from '../Button'
import { PopupPanel } from '../Popup/PopupPanel'
import { PopupSurface } from '../Popup/PopupSurface'
import type { CellIssueAction, CellIssueDetail } from './CellIssue'

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
        <PopupSurface
          positioner={
            <Popover.Positioner anchor={anchor} side="bottom" align="end" />
          }
          popup={
            <Popover.Popup
              finalFocus={anchor}
              aria-labelledby={titleId}
              data-testid="cell-issue-popover"
              data-tone={tone}
            />
          }
          className={styles.popup}
        >
          <PopupPanel
            title={title}
            titleId={titleId}
            footerClassName={styles.actions}
            footer={
              ordered.length > 0
                ? ordered.map(action => (
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
                  ))
                : undefined
            }
          >
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
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default CellIssuePopup
