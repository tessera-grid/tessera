/**
 * Контрол пагинации в нижней панели (ADR 0038): выбор размера, диапазон
 * «from–to of total», кнопки «первая/назад/вперёд/последняя». Размечен как
 * `navigation`; бизнес-колбэк — на действие пользователя.
 */
import { lazy, Suspense, useEffect } from 'react'

import type { PaginationState } from '@tanstack/react-table'
import { ChevronDown } from 'lucide-react'

import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import {
  clampedPageIndex,
  notifyPageChange,
  pageRange,
  paginationInertReason,
  type PaginationTable,
  resolvePageSizes,
} from './model'
import { PageButton } from './PageButton'
import styles from './Pagination.module.css'

const PageSizeSelect = lazy(() =>
  import('./PageSizeSelect').then(module => ({
    default: module.PageSizeSelect,
  })),
)

const ICON_SIZE = 18

export const PaginationControl = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  const icons = useIcons()
  const t = table as unknown as PaginationTable
  const pagination = useTableState(table, state => state.pagination) as
    PaginationState | undefined

  const inert = paginationInertReason(table) !== undefined
  const rowCount = inert ? 0 : t.getRowCount()
  const pageCount = inert ? 0 : t.getPageCount()
  const pageIndex = pagination?.pageIndex ?? 0
  const manual = !!t.options.manualPagination

  // Строк стало меньше, а страница осталась прежней — к последней существующей.
  useEffect(() => {
    if (inert || manual || pageIndex === 0) {
      return
    }
    const clamped = clampedPageIndex(pageIndex, pageCount)
    if (clamped !== pageIndex) {
      t.setPageIndex(clamped)
    }
  }, [inert, manual, t, pageIndex, pageCount])

  if (!pagination || inert) {
    return null
  }

  const { pageSize } = pagination
  const { from, to } = pageRange(pagination, rowCount)
  const lastIndex = Math.max(0, pageCount - 1)
  const pageSizesOption = (
    table.options as { paginationPageSizes?: number[] | false }
  ).paginationPageSizes

  const goTo = (index: number) => {
    t.setPageIndex(index)
    notifyPageChange(t, index, pageSize)
  }

  const changeSize = (size: number) => {
    t.setPagination({ pageIndex: 0, pageSize: size })
    notifyPageChange(t, 0, size)
  }

  const empty = rowCount === 0
  const atStart = empty || pageIndex <= 0
  const atEnd = empty || pageIndex >= lastIndex

  return (
    <nav
      aria-label={labels.pagination}
      className={styles.pagination}
      data-testid="pagination"
    >
      {pageSizesOption !== false && (
        <div className={styles.pageSize}>
          <Suspense
            fallback={
              <>
                <span className={styles.label}>{labels.rowsPerPage}</span>
                <button
                  type="button"
                  className={styles.trigger}
                  aria-label={labels.rowsPerPage}
                >
                  {pageSize}
                  <ChevronDown
                    width={14}
                    height={14}
                    className={styles.triggerIcon}
                  />
                </button>
              </>
            }
          >
            <PageSizeSelect
              label={labels.rowsPerPage}
              pageSize={pageSize}
              pageSizes={resolvePageSizes(pageSizesOption ?? [], pageSize)}
              onChange={changeSize}
            />
          </Suspense>
        </div>
      )}
      <span className={styles.range} data-testid="pagination-range">
        {labels.pageRange(from, to, rowCount)}
      </span>
      <div className={styles.buttons}>
        <PageButton
          action="first"
          label={labels.firstPage}
          icon={<icons.firstPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atStart}
          onClick={() => goTo(0)}
        />
        <PageButton
          action="previous"
          label={labels.previousPage}
          icon={<icons.previousPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atStart}
          onClick={() => goTo(pageIndex - 1)}
        />
        <PageButton
          action="next"
          label={labels.nextPage}
          icon={<icons.nextPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atEnd}
          onClick={() => goTo(pageIndex + 1)}
        />
        <PageButton
          action="last"
          label={labels.lastPage}
          icon={<icons.lastPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atEnd}
          onClick={() => goTo(lastIndex)}
        />
      </div>
    </nav>
  )
}
