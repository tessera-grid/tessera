/**
 * Интерфейс пагинации (ADR 0038): зажим индекса, диапазон страниц, варианты размера и
 * смена страницы пользователем. Модель — `paginationModel`.
 */
import type { PaginationState } from '@tanstack/react-table'

import { runServerAction } from '../../core/serverActions'
import type { PaginationTable } from '../paginationModel/model'
import type { PaginationHooks } from './types'

/** Индекс за пределами после сокращения данных — к последней странице (PG11). */
export const clampedPageIndex = (
  pageIndex: number,
  pageCount: number,
): number => Math.max(0, Math.min(pageIndex, pageCount - 1))

/** «from–to» текущей страницы; пустой набор — `0–0`. */
export const pageRange = (
  { pageIndex, pageSize }: PaginationState,
  rowCount: number,
): { from: number; to: number } =>
  rowCount === 0
    ? { from: 0, to: 0 }
    : {
        from: pageIndex * pageSize + 1,
        to: Math.min((pageIndex + 1) * pageSize, rowCount),
      }

/** Варианты размера страницы: заданный `pageSize` всегда среди них. */
export const resolvePageSizes = (
  pageSizes: readonly number[],
  pageSize: number,
): number[] => [...new Set([...pageSizes, pageSize])].sort((a, b) => a - b)

/** Контрол пагинатора — причина серверного действия (ADR 0116, §3). */
export type PageControl = 'first' | 'previous' | 'next' | 'last' | 'size'

export const pageControl = (control: PageControl) => `pagination:${control}`

/**
 * Смена страницы пользователем: `apply` меняет срез, `onPageChange` узнаёт о ней. В
 * серверном режиме — серверное действие с ожиданием и откатом (ADR 0116).
 */
export const changePageByUser = (
  table: PaginationTable,
  apply: () => void,
  pageIndex: number,
  pageSize: number,
  control: PageControl,
) => {
  const hooks = table.getHooks?.()?.pagination as
    Partial<PaginationHooks> | undefined
  runServerAction(
    table,
    'pagination',
    apply,
    context => hooks?.onPageChange?.(pageIndex, pageSize, context),
    { control: pageControl(control) },
  )
}
