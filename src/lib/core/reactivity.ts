/**
 * Реактивность: гранулярные подписки на состояние таблицы через TanStack Store.
 *
 * Компоненты грида/плагинов подписываются на СВОЙ срез — ре-рендер только при его
 * изменении:
 *  - `useSlice(table, 'sorting')` — один атом состояния (самая узкая подписка);
 *  - `useTableState(table, s => ({...}))` — проекция из общего store с
 *    shallow-сравнением;
 *  - `useSliceProjection(table, key, v => ...)` — проекция одного среза.
 */
import { useSelector } from '@tanstack/react-store'

import type { RowData, Table, TableFeatures, TableState } from '../types'

/** Поверхностное сравнение (react-store не экспортит `shallow` в публичных типах). */
export const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true
  }
  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false
  }
  const aKeys = Object.keys(a as object)
  const bKeys = Object.keys(b as object)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key =>
    Object.is(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  )
}

type SliceSource<T> = {
  get: () => T
  subscribe: (listener: (value: T) => void) => { unsubscribe: () => void }
}

/**
 * Subscribes to ONE state slice (`table.atoms[key]`). The component re-renders only when this
 * slice changes.
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
 * Подписка на срез-словарь со строкой на ключ (выбор строк): сравнение только по ссылке.
 * Поверхностное сравнение на сотнях тысяч ключей дороже перерисовки подписчика.
 */
export const useKeyedSlice = <T>(
  table: unknown,
  key: string,
): T | undefined => {
  const atoms = (table as { atoms: Record<string, SliceSource<T | undefined>> })
    .atoms
  return useSelector(atoms[key] ?? NO_SLICE, (value: T | undefined) => value, {
    compare: Object.is,
  })
}

/** Среза нет: его фича не подключена. */
const NO_SLICE = {
  get: () => undefined,
  subscribe: () => ({ unsubscribe: () => {} }),
}

/**
 * Подписка на ПРОЕКЦИЮ одного среза: ре-рендер только при смене проекции, а не
 * всего среза (напр. «редактируется ли эта ячейка» вместо всей сессии правки).
 */
export const useSliceProjection = <TSelected>(
  table: unknown,
  key: string,
  selector: (value: any) => TSelected,
): TSelected => {
  const atoms = (table as { atoms: Record<string, SliceSource<unknown>> }).atoms
  return useSelector(atoms[key], selector, { compare: shallowEqual })
}

/**
 * Subscribes to a PROJECTION of the shared store with shallow comparison. For components that
 * need several slices at once.
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
