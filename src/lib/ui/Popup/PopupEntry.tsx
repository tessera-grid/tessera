/**
 * Запись поповера со списком — облачко (ADR 0178, §8; DR42): точка слева, в строке подписи —
 * подпись, `aside` и кнопки записи, под ней — содержимое. С `onShow` подпись — кнопка перехода к
 * цели, её область растянута на облачко, кнопки записи лежат поверх.
 */
import type { MouseEvent, ReactNode } from 'react'
import { useId } from 'react'

import styles from './PopupEntry.module.css'

export interface PopupEntryProps {
  mark: ReactNode
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
  label,
  onShow,
  aside,
  actions,
  fit,
  children,
}: PopupEntryProps) => {
  const id = useId()
  return (
    <div className={styles.entry} data-fit={fit || undefined}>
      <span className={styles.mark} aria-hidden>
        {mark}
      </span>
      <div className={styles.head}>
        {onShow ? (
          // Переход озвучивает подпись, а содержимое облачка — описанием.
          <button
            type="button"
            className={styles.show}
            data-action="show"
            aria-describedby={children ? id : undefined}
            onClick={onShow}
          >
            {label}
          </button>
        ) : (
          <span className={styles.label}>{label}</span>
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
