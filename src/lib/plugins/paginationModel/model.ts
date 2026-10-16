/**
 * Модель пагинации поверх стоковой `rowPaginationFeature` (ADR 0038, ADR 0120): инертность
 * серверного режима и сброс страницы при смене порядка строк.
 */
import type { PaginationState } from '@tanstack/react-table'

import type { PluginDiagnose } from '../../core/pluginDiagnostics'

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
