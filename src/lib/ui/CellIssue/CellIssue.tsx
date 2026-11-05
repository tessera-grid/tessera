/**
 * Отметка проблемы ячейки (ADR 0177, §5): красный треугольник в правом верхнем углу — отказ
 * сохранения значения или ошибка данных. Рисует его ячейка, а не её кнопки, поэтому он один
 * и тот же для любого содержимого. Наведение — подсказка с причиной, только чтение; нажатие,
 * касание или Enter — поповер с причиной и действиями.
 */
import { Suspense, lazy, useId, useRef, useState } from 'react'

import { Tooltip } from '../Tooltip'

import hidden from '../visuallyHidden.module.css'
import styles from './CellIssue.module.css'

// Поповер — отдельный чанк по первому нажатию: Base UI-попап тянет позиционирование, а
// треугольников в теле много (ADR 0061).
const CellIssuePopup = lazy(() => import('./CellIssuePopup'))

export interface CellIssueAction {
  id: string
  label: string
  onSelect: () => void
  /** Главное действие — справа, кнопка с рамкой. */
  primary?: boolean
}

/** Строка тела поповера: подпись и значение («Было», «Стало»). */
export interface CellIssueDetail {
  label: string
  value: string
}

export interface CellIssueProps {
  /** Причина — подсказка, поповер и описание кнопки. */
  reason: string
  /** Доступное имя отметки. */
  label: string
  /** Заголовок поповера; без него — доступное имя. */
  title?: string
  /** Тело поповера строками вместо причины. */
  details?: readonly CellIssueDetail[]
  /** Действия поповера — «Повторить», «Отбросить изменение»; без них — только причина. */
  actions?: readonly CellIssueAction[]
  /**
   * `error` — отказ или ошибка: красный треугольник; `draft` — несохранённое изменение
   * (ADR 0178, §6): треугольник цвета несохранённого.
   */
  tone?: 'error' | 'draft'
}

export const CellIssue = ({
  reason,
  label,
  title = label,
  details,
  actions = [],
  tone = 'error',
}: CellIssueProps) => {
  const [open, setOpen] = useState(false)
  const reasonId = useId()
  const button = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Tooltip title={reason} disabled={open}>
        <button
          ref={button}
          type="button"
          className={styles.issue}
          aria-label={label}
          aria-describedby={reasonId}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-cell-issue={tone === 'error' ? '' : undefined}
          data-cell-draft={tone === 'draft' ? '' : undefined}
          data-tone={tone}
          onClick={() => setOpen(true)}
        >
          <span className={styles.mark} aria-hidden />
          <span
            id={reasonId}
            className={hidden['visually-hidden']}
            data-visually-hidden=""
          >
            {reason}
          </span>
        </button>
      </Tooltip>
      {open && (
        <Suspense fallback={null}>
          <CellIssuePopup
            anchor={button}
            title={title}
            reason={reason}
            details={details}
            actions={actions}
            tone={tone}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  )
}
