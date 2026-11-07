/**
 * Интерфейс пагинации (ADR 0038): зажим индекса, диапазон страниц, варианты размера и
 * смена страницы пользователем. Модель — `paginationModel`.
 */
import { reportAction, sourceOf } from '../../core/debugActions'
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

/** Многоточие в ряду номеров: у начала и у конца — свои ключи. */
export type PageGap = 'gapStart' | 'gapEnd'

/** Мест в ряду номеров: первая, последняя, текущая с соседями и два многоточия. */
const PAGE_SLOTS = 7
/** Сколько страниц подряд стоит у края ряда, пока одно многоточие не нужно. */
const EDGE_RUN = 5

const pageRun = (from: number, count: number) =>
  Array.from({ length: count }, (_, offset) => from + offset)

/** Ряд номеров (ADR 0192, §2): индексы страниц и многоточия; мест всегда поровну. */
export const pageSlots = (
  pageIndex: number,
  pageCount: number,
): (number | PageGap)[] => {
  if (pageCount <= PAGE_SLOTS) return pageRun(0, pageCount)
  const last = pageCount - 1
  if (pageIndex < EDGE_RUN - 1) return [...pageRun(0, EDGE_RUN), 'gapEnd', last]
  if (pageIndex > last - EDGE_RUN + 1)
    return [0, 'gapStart', ...pageRun(pageCount - EDGE_RUN, EDGE_RUN)]
  return [
    0,
    'gapStart',
    pageIndex - 1,
    pageIndex,
    pageIndex + 1,
    'gapEnd',
    last,
  ]
}

/**
 * Индекс страницы из текста поля: номер приводится к границам; пусто и не число — `undefined`.
 * Разделители разрядов допускаются: поле показывает номер на языке таблицы.
 */
export const parsePageInput = (text: string, pageCount: number) => {
  const digits = text.replace(/[\s.,]/g, '')
  if (!/^\d+$/.test(digits)) return undefined
  return clampedPageIndex(Number(digits) - 1, pageCount)
}

/** Контрол пагинатора — причина серверного действия (ADR 0116, §3). */
export type PageControl =
  'first' | 'previous' | 'next' | 'last' | 'page' | 'size'

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
  reportAction(table, {
    plugin: 'pagination',
    action: control === 'size' ? 'changePageSize' : 'changePage',
    detail: { pageIndex, pageSize, control },
    source: sourceOf(globalThis.event),
  })
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
