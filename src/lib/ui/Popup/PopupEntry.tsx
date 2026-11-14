/**
 * Запись поповера со списком — облачко (ADR 0178, §8; DR42): точка слева, в строке подписи —
 * подпись, `aside` и кнопки записи, под ней — содержимое. С `onShow` подпись — кнопка перехода к
 * цели, её область растянута на облачко, кнопки записи лежат поверх.
 */
import type { MouseEvent, ReactNode } from 'react'
import { useId, useRef } from 'react'

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
  children,
}: PopupEntryProps) => {
  const id = useId()
  const showRef = useRef<HTMLButtonElement>(null)
  return (
    <div
      className={styles.entry}
      data-popup-entry=""
      data-fit={fit || undefined}
    >
      <span className={styles.mark} data-popup-entry-mark="" aria-hidden>
        {mark}
      </span>
      {markHint && (
        <Tooltip title={markHint} longPress>
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
            aria-describedby={children ? id : undefined}
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
      {children && (
        <div id={id} className={styles.body}>
          {children}
        </div>
      )}
    </div>
  )
}
