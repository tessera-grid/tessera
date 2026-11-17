/**
 * Запись поповера со списком — облачко (ADR 0178, §8; DR42): точка слева, в строке подписи —
 * подпись, `aside` и кнопки записи, под ней — содержимое и строка ошибки. С `onShow` подпись —
 * кнопка перехода к цели, её область растянута на облачко, кнопки записи лежат поверх.
 */
import type { FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'

import { useIcons } from '../icons'
import { Tooltip } from '../Tooltip'

import styles from './PopupEntry.module.css'

export interface PopupEntryProps {
  mark: ReactNode
  /**
   * Что значит точка (ADR 0224): подсказка над полосой от края облачка до подписи на всю его
   * высоту; на касаниях — удержанием. Нажатие на полосу — переход `onShow`.
   */
  markHint?: string
  label: ReactNode
  /** Переход к цели записи; без него облачко не нажимается. */
  onShow?: (event: MouseEvent<HTMLButtonElement>) => void
  /** Справа от подписи, перед кнопками: время записи. */
  aside?: ReactNode
  actions?: ReactNode
  /** Высота по содержимому: иначе облачка одной высоты, на две строки содержимого. */
  fit?: boolean
  /** Действие записи не удалось (ADR 0227, §7): строка со значком в тоне ошибки под содержимым. */
  error?: string
  children?: ReactNode
}

export const PopupEntry = ({
  mark,
  markHint,
  label,
  onShow,
  aside,
  actions,
  fit,
  error,
  children,
}: PopupEntryProps) => {
  const id = useId()
  const showRef = useRef<HTMLButtonElement>(null)
  // Подсказка точки по фокусу с клавиатуры на записи (ADR 0232, KX9; WCAG 1.4.13).
  const [hintShown, setHintShown] = useState(false)
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (markHint && (event.target as HTMLElement).matches(':focus-visible'))
      setHintShown(true)
  }
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      setHintShown(false)
  }
  // Escape сперва скрывает подсказку, не уводя фокус; следующий — закрывает поповер.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !hintShown) return
    event.stopPropagation()
    event.preventDefault()
    setHintShown(false)
  }
  const { loadMoreFailed: ErrorIcon } = useIcons()
  const body = children || error
  return (
    <div
      className={styles.entry}
      data-popup-entry=""
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-fit={fit || undefined}
    >
      <span className={styles.mark} data-popup-entry-mark="" aria-hidden>
        {mark}
      </span>
      {markHint && (
        <Tooltip title={markHint} longPress shown={hintShown}>
          <span
            className={styles.markHint}
            data-popup-entry-mark-hint=""
            data-show={onShow ? '' : undefined}
            aria-hidden
            onClick={() => showRef.current?.click()}
          />
        </Tooltip>
      )}
      <div className={styles.head}>
        {onShow ? (
          // Переход озвучивает подпись, а содержимое облачка — описанием.
          <button
            ref={showRef}
            type="button"
            className={styles.show}
            data-popup-entry-label=""
            data-action="show"
            aria-describedby={body ? id : undefined}
            onClick={onShow}
          >
            {label}
          </button>
        ) : (
          <span className={styles.label} data-popup-entry-label="">
            {label}
          </span>
        )}
        {aside}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {body && (
        <div id={id} className={styles.body}>
          {children}
          {error && (
            <span className={styles.error} data-popup-entry-error="">
              <ErrorIcon className={styles.errorIcon} aria-hidden />
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
