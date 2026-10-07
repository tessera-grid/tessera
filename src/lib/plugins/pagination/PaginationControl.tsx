/**
 * Контрол пагинации в нижней панели (ADR 0038): выбор размера, диапазон
 * «from–to of total», кнопки «первая/назад/вперёд/последняя». Размечен как
 * `navigation`; бизнес-колбэк — на действие пользователя.
 */
import {
  type ButtonHTMLAttributes,
  forwardRef,
  Suspense,
  useEffect,
} from 'react'

import type { PaginationState } from '@tanstack/react-table'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

import { announceLabel } from '../../core/announcer'
import { useLazyPopover } from '../../core/lazyOpening'
import { preloadable } from '../../core/preloadable'
import { type ButtonStatesProps, useButtonStates } from '../../ui/buttonStates'
import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { Skeleton } from '../../ui/Skeleton'
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

const PageSizeSelect = preloadable(() =>
  import('./PageSizeSelect').then(module => module.PageSizeSelect),
)

/** Кнопка-заглушка выбора размера до загрузки его модуля: ожидание и вспышка по контуру. */
const PlaceholderButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & ButtonStatesProps
>(({ pending, errorFlash, onClick, className, ...rest }, ref) => {
  const states = useButtonStates(ref, { pending, errorFlash }, onClick)
  return (
    <button
      type="button"
      {...rest}
      ref={states.ref}
      aria-busy={states['aria-busy']}
      data-error-flash={states['data-error-flash']}
      onClick={states.onClick}
      className={clsx(styles.trigger, states.className, className)}
    />
  )
})

const ICON_SIZE = 18
/** Ширина скелета диапазона «1–25 of 1000» на время первой загрузки. */
const RANGE_SKELETON_WIDTH = 96

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
  // Заглушку сменяет выбор по состоянию: клик по ней до загрузки не теряется (PG20),
  // ожидание и ошибка загрузки видны на ней (ADR 0061, LZ15–LZ16).
  const sizeSelect = useLazyPopover(
    table,
    PageSizeSelect,
    all => all.rowsPerPage,
  )

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

  const announcePage = (index: number, pages: number) =>
    announceLabel(table, all => all.pageAnnouncement(index + 1, pages))

  const goTo = (index: number) => {
    t.setPageIndex(index)
    notifyPageChange(t, index, pageSize)
    announcePage(index, pageCount)
  }

  const changeSize = (size: number) => {
    t.setPagination({ pageIndex: 0, pageSize: size })
    notifyPageChange(t, 0, size)
    announcePage(0, Math.max(1, Math.ceil(rowCount / size)))
  }

  const sizePlaceholder = (
    <>
      <span className={styles.label}>{labels.rowsPerPage}</span>
      <PlaceholderButton
        aria-label={labels.rowsPerPage}
        aria-haspopup="listbox"
        {...sizeSelect.trigger}
      >
        {pageSize}
        <ChevronDown width={14} height={14} className={styles.triggerIcon} />
      </PlaceholderButton>
    </>
  )

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
          {sizeSelect.ready ? (
            <Suspense fallback={sizePlaceholder}>
              <PageSizeSelect.Component
                label={labels.rowsPerPage}
                pageSize={pageSize}
                pageSizes={resolvePageSizes(pageSizesOption ?? [], pageSize)}
                onChange={changeSize}
                open={sizeSelect.open}
                onOpenChange={sizeSelect.onOpenChange}
              />
            </Suspense>
          ) : (
            sizePlaceholder
          )}
        </div>
      )}
      <span className={styles.range} data-testid="pagination-range">
        {isSkeletonShown(table) ? (
          <Skeleton width={RANGE_SKELETON_WIDTH} height={14} />
        ) : (
          labels.pageRange(from, to, rowCount)
        )}
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
