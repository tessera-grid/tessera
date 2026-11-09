/**
 * Контрол пагинации в нижней панели (ADR 0038): выбор размера, диапазон
 * «from–to of total», кнопки «первая/назад/вперёд/последняя». Размечен как
 * `navigation`; бизнес-колбэк — на действие пользователя.
 */
import { useEffect, useId } from 'react'

import type { PaginationState } from '@tanstack/react-table'

import { announceLabel } from '../../core/announcer'
import { useLazyPopover } from '../../core/lazyOpening'
import { preloadable } from '../../util/preloadable'
import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { Skeleton } from '../../ui/Skeleton'
import { useIcons } from '../../ui/icons'
import {
  changePageByUser,
  clampedPageIndex,
  pageRange,
  resolvePageSizes,
} from './model'
import { pluginStateKey } from '../../core/definePlugin'
import {
  isManualPagination,
  pageCountsOf,
  paginationInertReason,
  type PaginationTable,
} from '../paginationModel/model'
import { type PageAction, PageButton } from './PageButton'
import { PageNumberButtons, PageNumberInput } from './PageNumbers'
import { SelectTrigger } from '../../ui/SelectTrigger/SelectTrigger'
import styles from './Pagination.module.css'
import { paginationLabels } from './labels'

const PageSizeSelect = preloadable(() =>
  import('./PageSizeSelect').then(module => module.PageSizeSelect),
)

const ICON_SIZE = 16
const empty = (rowCount: number) => rowCount === 0
/** Ширина скелета диапазона «1–25 of 1000» на время первой загрузки. */
const RANGE_SKELETON_WIDTH = 96

export const PaginationControl = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  const icons = useIcons()
  const t = table as unknown as PaginationTable
  const pagination = useTableState(table, state => state.pagination) as
    PaginationState | undefined

  // Корни серверной модели строк приходят блоками (ADR 0158, §4).
  useTableState(
    table,
    state =>
      (state as unknown as Record<string, unknown>)[
        pluginStateKey('serverRowModel')
      ],
  )

  const inert = paginationInertReason(table) !== undefined
  const counts = inert
    ? { rowCount: 0, pageCount: 0, known: true }
    : pageCountsOf(table, pagination?.pageSize ?? 1)
  const { rowCount, pageCount, known } = counts
  const pageIndex = pagination?.pageIndex ?? 0
  const manual = isManualPagination(table)
  // Заглушку сменяет выбор по состоянию: клик по ней до загрузки не теряется (PG20),
  // ожидание и ошибка загрузки видны на ней (ADR 0061, LZ15–LZ16).
  const sizeSelect = useLazyPopover(
    table,
    PageSizeSelect,
    all => paginationLabels(all).rowsPerPage,
    true,
    { plugin: 'pagination', detail: () => ({ menu: 'pageSize' }) },
  )
  const sizeLabelId = useId()
  const sizeTriggerId = useId()

  // Строк стало меньше, а страница осталась прежней — к последней существующей.
  useEffect(() => {
    if (inert || manual || !known || pageIndex === 0) {
      return
    }
    const clamped = clampedPageIndex(pageIndex, pageCount)
    if (clamped !== pageIndex) {
      t.setPageIndex(clamped)
    }
  }, [inert, manual, known, t, pageIndex, pageCount])

  if (!pagination || inert) {
    return null
  }

  const { pageSize } = pagination
  const { from, to } = pageRange(pagination, rowCount)
  const lastIndex = Math.max(0, pageCount - 1)
  const pageSizesOption = table.options.paginationPageSizes
  // Номера — только при известном итоге: прыжок мог бы уйти за конец данных (ADR 0192, §6).
  const pageNumbers =
    known && !inert && !empty(rowCount)
      ? (table.options.paginationPageNumbers ?? false)
      : false

  const announcePage = (index: number, pages: number | undefined) =>
    announceLabel(table, all =>
      pages === undefined
        ? paginationLabels(all).pageAnnouncementOfMany(index + 1)
        : paginationLabels(all).pageAnnouncement(index + 1, pages),
    )

  const goTo = (index: number, control: PageAction) => {
    changePageByUser(t, () => t.setPageIndex(index), index, pageSize, control)
    announcePage(index, known ? pageCount : undefined)
  }

  const changeSize = (size: number) => {
    changePageByUser(
      t,
      () => t.setPagination({ pageIndex: 0, pageSize: size }),
      0,
      size,
      'size',
    )
    announcePage(0, known ? Math.max(1, Math.ceil(rowCount / size)) : undefined)
  }

  const sizePlaceholder = (
    <>
      <span id={sizeLabelId} className={styles.label}>
        {paginationLabels(labels).rowsPerPage}
      </span>
      {/* Имя — подпись и видимое значение, как у настоящего списка (WCAG 2.5.3). */}
      <SelectTrigger
        id={sizeTriggerId}
        aria-labelledby={`${sizeLabelId} ${sizeTriggerId}`}
        aria-haspopup="listbox"
        {...sizeSelect.trigger}
      >
        {pageSize}
      </SelectTrigger>
    </>
  )

  const atStart = empty(rowCount) || pageIndex <= 0
  // Итог неизвестен: дальше можно, пока впереди есть корни; последней страницы нет (§4).
  const atEnd =
    empty(rowCount) ||
    (known ? pageIndex >= lastIndex : (pageIndex + 1) * pageSize >= rowCount)

  return (
    <nav
      aria-label={paginationLabels(labels).pagination}
      className={styles.pagination}
      data-testid="pagination"
    >
      {pageSizesOption !== false && (
        <div className={styles.pageSize}>
          {sizeSelect.ready ? (
            <PageSizeSelect.Component
              fallback={sizePlaceholder}
              label={paginationLabels(labels).rowsPerPage}
              pageSize={pageSize}
              pageSizes={resolvePageSizes(pageSizesOption ?? [], pageSize)}
              onChange={changeSize}
              open={sizeSelect.open}
              onOpenChange={sizeSelect.onOpenChange}
            />
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
        ) : known ? (
          paginationLabels(labels).pageRange(from, to, rowCount)
        ) : (
          paginationLabels(labels).pageRangeOfMany(from, to)
        )}
      </span>
      <div
        className={styles.buttons}
        data-page-numbers={pageNumbers || undefined}
      >
        <PageButton
          action="first"
          className={styles.edge}
          label={paginationLabels(labels).firstPage}
          icon={<icons.firstPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atStart}
          onClick={() => goTo(0, 'first')}
        />
        <PageButton
          action="previous"
          label={paginationLabels(labels).previousPage}
          icon={<icons.previousPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atStart}
          onClick={() => goTo(pageIndex - 1, 'previous')}
        />
        {pageNumbers === 'buttons' && (
          <PageNumberButtons
            pageIndex={pageIndex}
            pageCount={pageCount}
            onChange={index => goTo(index, 'page')}
          />
        )}
        {pageNumbers === 'input' && (
          <PageNumberInput
            pageIndex={pageIndex}
            pageCount={pageCount}
            onChange={index => goTo(index, 'page')}
          />
        )}
        <PageButton
          action="next"
          label={paginationLabels(labels).nextPage}
          icon={<icons.nextPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atEnd}
          onClick={() => goTo(pageIndex + 1, 'next')}
        />
        <PageButton
          action="last"
          className={styles.edge}
          label={paginationLabels(labels).lastPage}
          icon={<icons.lastPage width={ICON_SIZE} height={ICON_SIZE} />}
          disabled={atEnd || !known}
          onClick={() => goTo(lastIndex, 'last')}
        />
      </div>
    </nav>
  )
}
