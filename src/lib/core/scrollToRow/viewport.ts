// Окно прокрутки смонтированного грида (ADR 0104, §4): контейнер и виртуализаторы строк
// и колонок. Таблица о гриде не знает — `DataGrid` регистрирует окно на хранилище
// таблицы и снимает при размонтировании.
import type { Virtualizer } from '../../../vendor/tanstack-virtual/react-virtual'

import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'

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

/** Грид таблицы смонтирован, но ещё за рамкой первого рендера (ADR 0203, §6). */
const pendingGrids = new WeakMap<object, number>()
const waiters = new WeakMap<object, Set<() => void>>()
const wake = (store: object) => waiters.get(store)?.forEach(fn => fn())

/** Грид рисует рамку первого рендера: вызовы прокрутки ждут его окна. Снять — вызовом. */
export const markGridPending = (table: unknown) => {
  const store = storeOf(table)
  pendingGrids.set(store, (pendingGrids.get(store) ?? 0) + 1)
  return () => {
    pendingGrids.set(store, (pendingGrids.get(store) ?? 1) - 1)
    // После коммита: грид, ставший готовым, к этому времени зарегистрировал окно.
    queueMicrotask(() => wake(store))
  }
}

/**
 * Окно прокрутки грида; пока грид за рамкой первого рендера — ждёт его (ADR 0203, §6).
 * Грида нет или он размонтирован до готовности — `undefined`.
 */
export const whenViewport = (
  table: unknown,
): Promise<ScrollViewport | undefined> => {
  const store = storeOf(table)
  const ready = viewports.get(store)
  if (ready || !pendingGrids.get(store)) return Promise.resolve(ready)
  return new Promise(resolve => {
    const set = waiters.get(store) ?? new Set<() => void>()
    waiters.set(store, set)
    const check = () => {
      const viewport = viewports.get(store)
      if (!viewport && pendingGrids.get(store)) return
      set.delete(check)
      resolve(viewport)
    }
    set.add(check)
  })
}

export const useScrollViewport = (
  table: unknown,
  { getScrollElement, rows, columns }: ScrollViewport,
) => {
  const store = storeOf(table)
  useIsomorphicLayoutEffect(() => {
    const viewport = { getScrollElement, rows, columns }
    viewports.set(store, viewport)
    wake(store)
    return () => {
      if (viewports.get(store) === viewport) viewports.delete(store)
    }
  }, [store, getScrollElement, rows, columns])
}
