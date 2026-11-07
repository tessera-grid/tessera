/**
 * Ряд номеров страниц и поле номера (ADR 0192). Смену страницы ведёт контрол пагинации;
 * вид при узкой панели задаёт CSS по `[data-status-bar-layout]`: перемонтировать нечего.
 */
import { type KeyboardEvent, useState } from 'react'

import { useLocalization } from '../../core/localization'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field/Field'
import { parsePageInput, pageSlots } from './model'
import { paginationLabels } from './labels'
import styles from './Pagination.module.css'

interface PageNumbersProps {
  pageIndex: number
  pageCount: number
  onChange: (index: number) => void
}

export const PageNumberButtons = ({
  pageIndex,
  pageCount,
  onChange,
}: PageNumbersProps) => {
  const labels = paginationLabels(useLocalization())
  return (
    <div className={styles.numbers} data-testid="pagination-numbers">
      {pageSlots(pageIndex, pageCount).map(slot =>
        typeof slot === 'number' ? (
          <Button
            key={slot}
            variant="ghost"
            className={styles.number}
            aria-label={labels.goToPage(slot + 1)}
            aria-current={slot === pageIndex ? 'page' : undefined}
            data-page-number={slot + 1}
            onClick={() => {
              if (slot !== pageIndex) onChange(slot)
            }}
          >
            {labels.pageNumber(slot + 1)}
          </Button>
        ) : (
          <span key={slot} className={styles.gap} aria-hidden="true">
            …
          </span>
        ),
      )}
    </div>
  )
}

export const PageNumberInput = ({
  pageIndex,
  pageCount,
  onChange,
}: PageNumbersProps) => {
  const labels = paginationLabels(useLocalization())
  // Введённое, пока пользователь не применил его; иначе поле показывает страницу.
  const [draft, setDraft] = useState<string>()

  const apply = () => {
    if (draft === undefined) return
    setDraft(undefined)
    const index = parsePageInput(draft, pageCount)
    if (index !== undefined && index !== pageIndex) onChange(index)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') apply()
    else if (event.key === 'Escape' && draft !== undefined) {
      event.stopPropagation()
      setDraft(undefined)
    }
  }

  return (
    <div className={styles.pageInput} data-testid="pagination-input">
      <div className={styles.pageFieldBox}>
        <span className={styles.pageSizer} aria-hidden="true">
          {labels.pageNumber(pageCount)}
        </span>
        <Field
          className={styles.pageField}
          inputMode="numeric"
          autoComplete="off"
          aria-label={labels.pageInput}
          value={draft ?? labels.pageNumber(pageIndex + 1)}
          onChange={event => setDraft(event.target.value)}
          onFocus={event => event.target.select()}
          onBlur={apply}
          onKeyDown={onKeyDown}
        />
      </div>
      <span className={styles.pageTotal}>{labels.pageOfTotal(pageCount)}</span>
    </div>
  )
}
