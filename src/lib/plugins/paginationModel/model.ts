/**
 * Модель пагинации поверх стоковой `rowPaginationFeature` (ADR 0038, ADR 0120): инертность
 * серверного режима и сброс страницы при смене порядка строк.
 */
import type { PaginationState } from '@tanstack/react-table'

import { dataModeOf } from '../../core/dataMode'
import {
  type PluginDiagnose,
  serverRowModelReason,
} from '../../core/pluginDiagnostics'
import { rowSourceOf } from '../../core/rowSource'

interface Atom<T> {
  get: () => T
  subscribe: (listener: (value: T) => void) => { unsubscribe: () => void }
}

export interface PaginationTable {
  options: {
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
 * Страницы режет сервер, а `data` — текущая страница (ADR 0169). В серверной модели строк
 * данные страниц запрашивает грид (ADR 0158).
 */
export const isManualPagination = (table: unknown) =>
  dataModeOf(table, 'pagination') === 'server' && !serverRowModelReason(table)

/** Страницы режет сервер: без итога `rowCount` таблицы число страниц неизвестно (PG8). */
export const paginationInertReason: PluginDiagnose = table => {
  const { rowCount, pageCount } = (table as PaginationTable).options
  return isManualPagination(table) &&
    rowCount === undefined &&
    pageCount === undefined
    ? 'noRowCount'
    : undefined
}

/** Строк верхнего уровня во всём списке и страниц; `known` — итог известен. */
export const pageCountsOf = (
  table: unknown,
  pageSize: number,
): { rowCount: number; pageCount: number; known: boolean } => {
  const t = table as PaginationTable
  const source = rowSourceOf(table)
  // Серверная модель строк: корни считает источник, итог бывает неизвестен (ADR 0158, §4).
  if (serverRowModelReason(table) && source.rootCount) {
    const rowCount = source.total?.() === 0 ? 0 : source.rootCount()
    return {
      rowCount,
      pageCount: Math.ceil(rowCount / pageSize),
      known: source.rootCountKnown?.() ?? true,
    }
  }
  return { rowCount: t.getRowCount(), pageCount: t.getPageCount(), known: true }
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
      if (!isManualPagination(table)) {
        t.setPageIndex(0)
      }
    })
  })
  return () => subscriptions.forEach(sub => sub?.unsubscribe())
}
