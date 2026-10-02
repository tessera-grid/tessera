/**
 * Заглушка пустого результата фильтрации (ADR 0045, §9, FL27–FL28): поверх пустого
 * тела, шапка с кнопками фильтров остаётся. По умолчанию — подпись и «Сбросить
 * фильтры» (фильтры колонок и поиск); `filterStub` грида её заменяет.
 */
import type { ReactNode } from 'react'

import { resetFiltersByUser } from '../../core/filtering'
import { useLocalization } from '../../core/localization'

import styles from './FilterStub.module.css'

export type FilterStubRender =
  ReactNode | ((controls: { reset: () => void }) => ReactNode)

interface FilterStubProps {
  table: unknown
  render?: FilterStubRender
}

export const FilterStub = ({ table, render }: FilterStubProps) => {
  const labels = useLocalization()
  const reset = () => resetFiltersByUser(table)

  if (render !== undefined) {
    return (
      <div className={styles.stub} data-testid="filter-stub">
        {typeof render === 'function' ? render({ reset }) : render}
      </div>
    )
  }

  return (
    <div className={styles.stub} data-testid="filter-stub">
      <p className={styles.text}>{labels.noRowsMatchFilters}</p>
      <button
        type="button"
        className={styles.reset}
        onClick={reset}
        data-testid="filter-stub-reset"
      >
        {labels.resetFilters}
      </button>
    </div>
  )
}
