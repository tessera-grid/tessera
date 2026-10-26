// Окно прокрутки смонтированного грида (ADR 0104, §4): контейнер и виртуализаторы строк
// и колонок. Таблица о гриде не знает — `DataGrid` регистрирует окно на хранилище
// таблицы и снимает при размонтировании.
import type { Virtualizer } from '../../../vendor/tanstack-virtual/react-virtual'

import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect'

export interface ScrollViewport {
  getScrollElement: () => HTMLElement | null
  rows: Virtualizer<HTMLDivElement, HTMLDivElement>
  /** Нет, когда колонки не виртуализируются (вложенная шапка). */
  columns?: Virtualizer<HTMLDivElement, HTMLDivElement>
}

const viewports = new WeakMap<object, ScrollViewport>()

const storeOf = (table: unknown) => (table as { store: object }).store

export const viewportOf = (table: unknown): ScrollViewport | undefined =>
  viewports.get(storeOf(table))

export const useScrollViewport = (
  table: unknown,
  { getScrollElement, rows, columns }: ScrollViewport,
) => {
  const store = storeOf(table)
  useIsomorphicLayoutEffect(() => {
    const viewport = { getScrollElement, rows, columns }
    viewports.set(store, viewport)
    return () => {
      if (viewports.get(store) === viewport) viewports.delete(store)
    }
  }, [store, getScrollElement, rows, columns])
}
