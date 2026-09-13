/**
 * Фаза D — реактивность v9-слоя: гранулярные подписки на состояние таблицы через
 * TanStack Store, замена собственного Pub-Sub (useSubscribeStore, ADR 0007).
 *
 * Компоненты грида/плагинов подписываются на СВОЙ срез — ре-рендер только при его
 * изменении (то же, ради чего существовал Pub-Sub, но штатно):
 *  - `useSlice(table, 'sorting')` — один атом состояния (самая узкая подписка);
 *  - `useTableState(table, s => ({...}))` — проекция из общего store с shallow-сравнением
 *    (аналог `useSubscribeStore(() => [primitives])`).
 */
import { useSelector } from '@tanstack/react-store'

import type { RowData, Table, TableFeatures, TableState } from '../types'

/** Поверхностное сравнение (react-store не экспортит `shallow` в публичных типах). */
export const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true
  }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false
  }
  const aKeys = Object.keys(a as object)
  const bKeys = Object.keys(b as object)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key =>
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

type SliceSource<T> = {
  get: () => T
  subscribe: (listener: (value: T) => void) => { unsubscribe: () => void }
}

/**
 * Подписка на ОДИН срез состояния (`table.atoms[key]`). Компонент ре-рендерится
 * только при изменении этого среза — прямая замена
 * `useSubscribeStore(() => [table.getState().<key>...])`.
 */
export const useSlice = <
  TFeatures extends TableFeatures,
  TData extends RowData,
  K extends keyof TableState<TFeatures>,
>(
  table: Table<TFeatures, TData>,
  key: K,
): TableState<TFeatures>[K] => {
  const atoms = table.atoms as unknown as Record<
    K,
    SliceSource<TableState<TFeatures>[K]>
  >
  return useSelector(atoms[key])
}

/**
 * Подписка на ПРОЕКЦИЮ из общего store с shallow-сравнением. Для компонентов,
 * которым нужно несколько срезов сразу (как список примитивов в старом Pub-Sub).
 */
export const useTableState = <
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected,
>(
  table: Table<TFeatures, TData>,
  selector: (state: TableState<TFeatures>) => TSelected,
): TSelected => {
  const store = table.store as unknown as SliceSource<TableState<TFeatures>>
  return useSelector(store, selector, { compare: shallowEqual })
}
