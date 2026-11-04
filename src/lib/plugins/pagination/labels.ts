/** Подписи `pagination` (ADR 0182, §8): ключи словаря таблицы `pagination.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface PaginationLabels {
  /** Доступное имя контрола пагинации (`aria-label` на `role="navigation"`) */
  pagination: string
  /** Видимая метка выбора размера страницы */
  rowsPerPage: string
  /** Кнопки пагинации: тултипы и доступные имена */
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  /** Диапазон строк текущей страницы: «1–25 of 1000» */
  pageRange: (from: number, to: number, total: number) => string
  /** Диапазон строк страницы, когда итог неизвестен: «1–25 of many» (ADR 0158) */
  pageRangeOfMany: (from: number, to: number) => string
  /** Объявление смены страницы */
  pageAnnouncement: (page: number, pages: number) => string
  /** Объявление смены страницы, когда число страниц неизвестно */
  pageAnnouncementOfMany: (page: number) => string
  /** Действие: смена страницы */
  actionChangePage: string
  /** Действие: смена размера страницы */
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
    pageRange: '{from}–{to} of {total}',
    pageRangeOfMany: '{from}–{to} of many',
    pageAnnouncement: 'Page {page} of {pages}',
    pageAnnouncementOfMany: 'Page {page}',
    actionChangePage: 'Change the page',
    actionChangePageSize: 'Change the page size',
  },
  {
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
