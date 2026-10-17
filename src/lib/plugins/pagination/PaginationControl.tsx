/**
 * Контрол пагинации в нижней панели (ADR 0038): выбор размера, диапазон
 * «from–to of total», кнопки «первая/назад/вперёд/последняя». Размечен как
 * `navigation`; бизнес-колбэк — на действие пользователя.
 */
import { Suspense, useEffect, useId } from 'react'

import type { PaginationState } from '@tanstack/react-table'
import { ChevronDown } from 'lucide-react'

import { announceLabel } from '../../core/announcer'
import { useLazyPopover } from '../../core/lazyOpening'
import { preloadable } from '../../core/preloadable'
import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { useServerActionMarks } from '../../core/serverActions'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { Skeleton } from '../../ui/Skeleton'
import { useIcons } from '../../ui/icons'
import {
  changePageByUser,
  clampedPageIndex,
  pageControl,
  pageRange,
  resolvePageSizes,
} from './model'
import {
  paginationInertReason,
  type PaginationTable,
} from '../paginationModel/model'
import { type PageAction, PageButton } from './PageButton'
import { SizeTrigger } from './SizeTrigger'
import styles from './Pagination.module.css'

const PageSizeSelect = preloadable(() =>
  import('./PageSizeSelect').then(module => module.PageSizeSelect),
)

const ICON_SIZE = 16
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
    true,
    { plugin: 'pagination', detail: () => ({ menu: 'pageSize' }) },
  )
  const sizeLabelId = useId()
  const sizeTriggerId = useId()
  const sizeServer = useServerActionMarks(
    table,
    cause => cause.control === pageControl('size'),
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

  const goTo = (index: number, control: PageAction) => {
    changePageByUser(t, () => t.setPageIndex(index), index, pageSize, control)
    announcePage(index, pageCount)
  }

  const changeSize = (size: number) => {
    changePageByUser(
      t,
      () => t.setPagination({ pageIndex: 0, pageSize: size }),
      0,
      size,
      'size',
    )
    announcePage(0, Math.max(1, Math.ceil(rowCount / size)))
  }

  const sizePlaceholder = (
    <>
      <span id={sizeLabelId} className={styles.label}>
        {labels.rowsPerPage}
      </span>
      {/* Имя — подпись и видимое значение, как у настоящего списка (WCAG 2.5.3). */}
      <SizeTrigger
        id={sizeTriggerId}
        aria-labelledby={`${sizeLabelId} ${sizeTriggerId}`}
        aria-haspopup="listbox"
        {...sizeSelect.trigger}
      >
        {pageSize}
        <ChevronDown width={14} height={14} className={styles.triggerIcon} />
      </SizeTrigger>
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
                pending={sizeServer.pending}
                errorFlash={sizeServer.flash}
              />
            </Suspense>
          ) : (
            sizePlaceholder
          )}
        </div>
      )}
      <span className={styles.range} data-testid="pagination-range">
        {isSkeletonShown(table) ? (
          <Skeleton
            width={RANGE_SKELETON_WIDTH}
            height="var(--tsr-comp-skeleton-text-height)"
          />
        ) : (
          labels.pageRange(from, to, rowCount)
        )}
      </span>
      <div className={styles.buttons}>
        <PageButton
          table={table}
          action="first"
          label={labels.firstPage}
          icon={<icons.firstPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atStart}
          onClick={() => goTo(0, 'first')}
        />
        <PageButton
          table={table}
          action="previous"
          label={labels.previousPage}
          icon={<icons.previousPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atStart}
          onClick={() => goTo(pageIndex - 1, 'previous')}
        />
        <PageButton
          table={table}
          action="next"
          label={labels.nextPage}
          icon={<icons.nextPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atEnd}
          onClick={() => goTo(pageIndex + 1, 'next')}
        />
        <PageButton
          table={table}
          action="last"
          label={labels.lastPage}
          icon={<icons.lastPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atEnd}
          onClick={() => goTo(lastIndex, 'last')}
        />
      </div>
    </nav>
  )
}
