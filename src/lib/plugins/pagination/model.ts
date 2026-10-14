/**
 * Модель пагинации поверх стоковой `rowPaginationFeature` (ADR 0038): инертность
 * серверного режима, сброс страницы при смене порядка строк, зажим индекса.
 */
import type { PaginationState } from '@tanstack/react-table'

import type { PluginDiagnose } from '../../core/pluginDiagnostics'
import { runServerAction } from '../../core/serverActions'
import type { PaginationHooks } from './types'

interface Atom<T> {
  get: () => T
  subscribe: (listener: (value: T) => void) => { unsubscribe: () => void }
}

export interface PaginationTable {
  options: {
    manualPagination?: boolean
    rowCount?: number
    pageCount?: number
  }
  atoms: Partial<
    Record<
      'sorting' | 'grouping' | 'columnFilters' | 'globalFilter',
      Atom<unknown>
    >
  > & {
    pagination?: Atom<PaginationState>
  }
  getRowCount: () => number
  getPageCount: () => number
  setPageIndex: (index: number) => void
  setPagination: (pagination: PaginationState) => void
  getHooks?: () => Record<string, unknown> | undefined
}

/**
 * Активный плагин с `manualPagination` — серверный режим: без итога число страниц
 * неизвестно (PG8).
 */
export const paginationInertReason: PluginDiagnose = table => {
  const { manualPagination, rowCount, pageCount } = (table as PaginationTable)
    .options
  return manualPagination && rowCount === undefined && pageCount === undefined
    ? 'noRowCount'
    : undefined
}

/**
 * Сортировка и группировка меняют порядок строк, фильтры и поиск — их набор: назад на
 * первую страницу (PG10, ADR 0045 FL19).
 */
export const resetPageOnReorder = (table: unknown) => {
  const t = table as PaginationTable
  const subscriptions = (
    ['sorting', 'grouping', 'columnFilters', 'globalFilter'] as const
  ).map(key => {
    const atom = t.atoms[key]
    if (!atom) {
      return undefined
    }
    let previous = atom.get()
    return atom.subscribe(next => {
      if (next === previous) {
        return
      }
      previous = next
      if (!t.options.manualPagination) {
        t.setPageIndex(0)
      }
    })
  })
  return () => subscriptions.forEach(sub => sub?.unsubscribe())
}

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

/**
 * Смена страницы пользователем: `apply` меняет срез, `onPageChange` узнаёт о ней. В
 * серверном режиме — серверное действие с ожиданием и откатом (ADR 0116).
 */
export const changePageByUser = (
  table: PaginationTable,
  apply: () => void,
  pageIndex: number,
  pageSize: number,
) => {
  const hooks = table.getHooks?.()?.pagination as
    Partial<PaginationHooks> | undefined
  runServerAction(table, 'pagination', apply, context =>
    hooks?.onPageChange?.(pageIndex, pageSize, context),
  )
}
