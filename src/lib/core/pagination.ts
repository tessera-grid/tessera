/**
 * Ядровой шов пагинации (плагин pagination, ADR 0038). Ядро НЕ импортит плагин:
 * страницу читает из стокового среза `pagination`, режим — из опций v9.
 *  - `getRowWindow` — место страницы в полном наборе для `aria-rowcount` и
 *    сквозного `aria-rowindex` (PG15);
 *  - `usePageChange` — после смены страницы тело прокручено к началу, активная
 *    ячейка клавиатурной навигации — на первой строке той же колонки (PG12, PG18).
 */
import { useEffect, useRef } from 'react'

import type { PaginationState } from '@tanstack/react-table'

import { setPluginState, pluginStateKey } from './definePlugin'
import {
  type ActiveCell,
  KEYBOARD_NAVIGATION,
  isKeyboardNavigationEnabled,
} from './keyboardNavigation'

interface WindowRow {
  getDisplayIndex?: () => number
}

interface PaginatedTable {
  options: { manualPagination?: boolean; rowCount?: number }
  atoms: { pagination?: { get: () => PaginationState } }
  getRowsInDisplayOrder?: () => unknown[]
}

export interface RowWindow {
  /** Строк данных до первой строки текущей страницы. */
  offset: number
  /** Строк данных во всём наборе (все страницы). */
  total: number
}

export const getRowWindow = (
  table: unknown,
  rows: readonly WindowRow[],
): RowWindow => {
  const t = table as PaginatedTable
  const pagination = t.atoms.pagination?.get()
  if (!pagination) {
    return { offset: 0, total: rows.length }
  }
  if (t.options.manualPagination) {
    // Серверная страница: смещение — по номеру страницы, итог — `rowCount`.
    // Без `rowCount` плагин выключен или инертен — страниц нет.
    if (t.options.rowCount === undefined) {
      return { offset: 0, total: rows.length }
    }
    const offset = pagination.pageIndex * pagination.pageSize
    return {
      offset,
      total: Math.max(t.options.rowCount, offset + rows.length),
    }
  }
  // Клиентская страница: порядок отображения учитывает раскрытых детей на
  // предыдущих страницах (страницы режутся по верхнему уровню).
  const order = t.getRowsInDisplayOrder?.()
  const first = rows[0]?.getDisplayIndex?.() ?? 0
  return {
    offset: Math.max(0, first),
    total: order?.length ?? rows.length,
  }
}

interface PageChangeTable {
  store: { get: () => Record<string, unknown> }
  options: { enableKeyboardNavigation?: boolean }
}

export const usePageChange = (
  table: unknown,
  pagination: PaginationState | undefined,
  rowCount: number,
  getScrollElement: () => HTMLElement | null,
) => {
  const previous = useRef<{ page?: PaginationState; rowCount: number }>({
    page: pagination,
    rowCount,
  })

  useEffect(() => {
    const before = previous.current
    previous.current = { page: pagination, rowCount }
    if (
      !pagination ||
      !before.page ||
      (before.page.pageIndex === pagination.pageIndex &&
        before.page.pageSize === pagination.pageSize)
    ) {
      return
    }

    getScrollElement()?.scrollTo({ top: 0 })

    if (!isKeyboardNavigationEnabled(table)) {
      return
    }
    const t = table as PageChangeTable
    const active = t.store.get()[pluginStateKey(KEYBOARD_NAVIGATION)] as
      ActiveCell | undefined
    // Шапка и футер (строка за последней строкой тела) от страницы не зависят.
    if (!active || active.rowIndex < 0 || active.rowIndex >= before.rowCount) {
      return
    }
    setPluginState(table, KEYBOARD_NAVIGATION, {
      ...active,
      rowIndex: 0,
    })
  }, [table, pagination, rowCount, getScrollElement])
}
