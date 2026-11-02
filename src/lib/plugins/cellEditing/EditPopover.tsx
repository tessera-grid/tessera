/**
 * Поповер правки под ячейкой (ADR 0175): в ячейке — текст значения, под ней — поповер
 * редактора. Escape и прокрутка таблицы отменяют правку (ED23), уход из поповера — `onLeave`;
 * клавиши поповера не доходят до навигации грида, фокус после закрытия возвращается в ячейку.
 */
import { type ReactNode, type RefObject, useEffect, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { restoreFocusIfLost } from '../../core/keyboardNavigation/actions'
import { useLocalization } from '../../core/localization'
import { Button } from '../../ui/Button'
import { usePortalThemeClass, usePortalThemeData } from '../../ui/theme'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { useCloseOnGridScroll } from '../../ui/Popup/useCloseOnGridScroll'

import styles from './EditPopover.module.css'

/**
 * Фокус ушёл на другой элемент страницы. Снятый фокус (`blur` в никуда — так его снимает и
 * приложение) правку не закрывает.
 */
export const movedFocus = (details: { reason: string; event?: Event }) =>
  details.reason === 'focus-out' &&
  !!(details.event as FocusEvent | undefined)?.relatedTarget

/** Правка закрылась — фокус в ячейку якоря, если он пропал вместе с поповером. */
export const useFocusReturn = (anchor: RefObject<HTMLElement | null>) =>
  useEffect(() => {
    const element = anchor.current?.closest<HTMLElement>(
      '.data-grid__body-cell',
    )
    return () => {
      if (element) restoreFocusIfLost(element)
    }
  }, [anchor])

/** «Очистить значение» — внизу поповера правки, отдельно от списка (ED16). */
export const ClearValue = ({ onClear }: { onClear: () => void }) => {
  const labels = useLocalization()
  return (
    <div className={styles.footer}>
      <Button variant="ghost" onClick={onClear} data-testid="edit-clear-value">
        {labels.editClear}
      </Button>
    </div>
  )
}

export const EditPopover = ({
  text,
  label,
  testId,
  initialFocus,
  onCancel,
  onLeave,
  children,
}: {
  /** Текст значения в ячейке под поповером. */
  text: string
  label: string
  testId: string
  /** Что получает фокус при открытии; `true` — первый фокусируемый. */
  initialFocus: (popup: HTMLElement | null) => HTMLElement | true
  onCancel: () => void
  /** Уход из поповера: нажатие или фокус на другом элементе. */
  onLeave: () => void
  children: ReactNode
}) => {
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  const anchor = useRef<HTMLSpanElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  useFocusReturn(anchor)
  useCloseOnGridScroll(true, onCancel)

  return (
    <span ref={anchor} className={styles.anchor}>
      {text}
      <Popover.Root
        open
        modal={false}
        onOpenChange={(open, details) => {
          if (open) return
          if (details.reason === 'escape-key') onCancel()
          else if (details.reason === 'outside-press' || movedFocus(details))
            onLeave()
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchor}
            side="bottom"
            align="start"
            sideOffset={POPUP_SIDE_OFFSET}
            className={clsx(themeClass, styles.positioner)}
            {...themeData}
          >
            <Popover.Popup
              ref={popup}
              aria-label={label}
              initialFocus={() => initialFocus(popup.current)}
              finalFocus={false}
              className={clsx(themeClass, styles.popup)}
              data-testid={testId}
              // Клавиши поповера — его, а не навигации грида.
              onKeyDown={event => event.stopPropagation()}
            >
              {children}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  )
}
