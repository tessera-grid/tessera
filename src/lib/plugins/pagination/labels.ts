/** Подписи `pagination` (ADR 0182, §8): ключи словаря таблицы `pagination.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface PaginationLabels {
  /** Accessible name of the pagination control (`aria-label` on `role="navigation"`) */
  pagination: string
  /** Visible label of the page size select */
  rowsPerPage: string
  /** Pagination buttons: tooltips and accessible names */
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  /** Page number button: accessible name and label — the number in the table's language */
  goToPage: (page: number) => string
  pageNumber: (page: number) => string
  /** Page number field: accessible name and the label on the right, "of 40" */
  pageInput: string
  pageOfTotal: (pages: number) => string
  /** Row range of the current page: "1–25 of 1000" */
  pageRange: (from: number, to: number, total: number) => string
  /** Row range of the page when the total is unknown: "1–25 of many" (ADR 0158) */
  pageRangeOfMany: (from: number, to: number) => string
  /** Page change announcement */
  pageAnnouncement: (page: number, pages: number) => string
  /** Page change announcement when the page count is unknown */
  pageAnnouncementOfMany: (page: number) => string
  /** Action: change the page */
  actionChangePage: string
  /** Action: change the page size */
  actionChangePageSize: string
}

export const paginationLabels = defineLabels<PaginationLabels>()(
  'pagination',
  {
    pagination: 'Pagination',
    rowsPerPage: 'Rows per page',
    firstPage: 'First page',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    lastPage: 'Last page',
    goToPage: 'Go to page {page}',
    pageNumber: '{page}',
    pageInput: 'Page number',
    pageOfTotal: 'of {pages}',
    pageRange: '{from}–{to} of {total}',
    pageRangeOfMany: '{from}–{to} of many',
    pageAnnouncement: 'Page {page} of {pages}',
    pageAnnouncementOfMany: 'Page {page}',
    actionChangePage: 'Change the page',
    actionChangePageSize: 'Change the page size',
  },
  {
    goToPage: ['page'],
    pageNumber: ['page'],
    pageOfTotal: ['pages'],
    pageRange: ['from', 'to', 'total'],
    pageRangeOfMany: ['from', 'to'],
    pageAnnouncement: ['page', 'pages'],
    pageAnnouncementOfMany: ['page'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    pagination: typeof paginationLabels
  }
}
