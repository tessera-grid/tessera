/**
 * Cutover — управление состоянием v9-таблицы. В v9 бо́льшую часть срезов держат
 * сами фичи (uncontrolled через getInitialState), поэтому ядро контролирует только:
 *  - columnPinning — чтобы применить пиннинг сервисных колонок (display-transform,
 *    ADR 0010 R10): политику объявляет плагин (`pin`), ядро исполняет; start/end (v9);
 *  - columnSizing — чтобы слить пользовательский ресайз с авто-слайсом плагинов
 *    (ширины служебных колонок, generic-escape ADR 0010).
 *
 * Остальные контролируемые слайсы (expanded/rowSelection/grouping/sorting/…)
 * прокидываются как есть из `state`/`handlers` потребителя. Публичные контролируемые
 * хуки (useRowSelectionState и т.д.) сохранены для совместимости API.
 */
import { useEffect, useMemo, useState } from 'react'

import {
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type ExpandedState,
  type GroupingState,
  type ColumnVisibilityState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, Table, TableFeatures, TableState } from '../types'

// --- Пиннинг сервисных колонок (start/end) -----------------------------------

export interface ServiceColumnPin {
  side: 'start' | 'end'
  when: 'always' | 'with-user'
}

export const defaultColumnPinningState: ColumnPinningState = {
  start: [],
  end: [],
}

export const mergeColumnPinning = (
  prev: ColumnPinningState | undefined,
  next: ColumnPinningState | undefined,
): ColumnPinningState => ({
  start: [...new Set([...(prev?.start || []), ...(next?.start || [])])],
  end: [...new Set([...(prev?.end || []), ...(next?.end || [])])],
})

/**
 * Слияние пользовательского пиннинга с сервисными колонками (ADR 0010, R10).
 * Только МЕХАНИКА: политику (сторона / всегда или только с пользователем) задаёт
 * плагин-владелец колонки. Сервисные колонки прижаты к внешнему краю блока:
 * leading — в начало start, trailing — в конец end.
 */
export const mergeServiceColumnPinning = (
  pinning: ColumnPinningState | undefined,
  serviceColumns: { id: string; pin?: ServiceColumnPin }[],
): ColumnPinningState => {
  const active = pinning ?? defaultColumnPinningState
  const userStart = active.start ?? []
  const userEnd = active.end ?? []
  const hasUserStart = userStart.length > 0
  const hasUserEnd = userEnd.length > 0

  const pinnedTo = (side: ServiceColumnPin['side'], hasUser: boolean) =>
    serviceColumns
      .filter(
        column =>
          column.pin?.side === side &&
          (column.pin.when === 'always' || hasUser),
      )
      .map(column => column.id)

  return {
    start: [...new Set([...pinnedTo('start', hasUserStart), ...userStart])],
    end: [...new Set([...userEnd, ...pinnedTo('end', hasUserEnd)])],
  }
}

// --- Размеры: слияние пользовательского ресайза с авто-слайсом ----------------

/**
 * Итоговый columnSizing. Авто-слайс плагинов (ширины служебных колонок) идёт
 * ПОСЛЕДНИМ и побеждает как контролируемый, так и внутренний размер (ADR 0013).
 */
export const mergeColumnSizing = (
  externalColumnSizing: ColumnSizingState | undefined,
  columnSizing: ColumnSizingState,
  columnAutoSizing: ColumnSizingState,
): ColumnSizingState => ({
  ...(externalColumnSizing ?? columnSizing),
  ...columnAutoSizing,
})

export const isSameColumnSizing = (
  a: ColumnSizingState,
  b: ColumnSizingState,
): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(key => a[key] === b[key])
}

// --- Публичные контролируемые стейт-хуки (совместимость API) ------------------

/**
 * Контролируемый срез. `initial` синхронизируется в состояние, НО только при смене
 * ССЫЛКИ initial — поэтому дефолты хуков обязаны быть СТАБИЛЬНЫМИ модуль-константами
 * (инлайн-литерал `{}`/`[]` в дефолте параметра создаёт новую ссылку каждый рендер →
 * useEffect стреляет каждый рендер → setState → бесконечный цикл).
 */
const useControlledSlice = <T>(initial: T): [T, OnChangeFn<T>] => {
  const [value, setValue] = useState<T>(initial)

  useEffect(() => {
    setValue(initial)
  }, [initial])

  return [value, setValue as OnChangeFn<T>]
}

const EMPTY_ORDER: ColumnOrderState = []
const EMPTY_VISIBILITY: ColumnVisibilityState = {}
const EMPTY_SIZING: ColumnSizingState = {}
const EMPTY_SORTING: SortingState = []
const EMPTY_SELECTION: RowSelectionState = {}
const EMPTY_EXPANDED: ExpandedState = {} as ExpandedState
const EMPTY_GROUPING: GroupingState = []

export const useColumnOrderState = (initial: ColumnOrderState = EMPTY_ORDER) => {
  const [columnOrder, onColumnOrderChange] = useControlledSlice(initial)
  return { columnOrder, onColumnOrderChange }
}

export const useColumnVisibilityState = (
  initial: ColumnVisibilityState = EMPTY_VISIBILITY,
) => {
  const [columnVisibility, onColumnVisibilityChange] =
    useControlledSlice(initial)
  return { columnVisibility, onColumnVisibilityChange }
}

export const useColumnSizingState = (initial: ColumnSizingState = EMPTY_SIZING) => {
  const [columnSizing, onColumnSizingChange] = useControlledSlice(initial)
  return { columnSizing, onColumnSizingChange }
}

export const useColumnPinningState = (
  initial: ColumnPinningState = defaultColumnPinningState,
) => {
  const merged = useMemo(
    () => mergeColumnPinning(defaultColumnPinningState, initial),
    [initial],
  )
  const [columnPinning, onColumnPinningChange] = useControlledSlice(merged)
  return { columnPinning, onColumnPinningChange }
}

export const useColumnSortingState = (initial: SortingState = EMPTY_SORTING) => {
  const [sorting, onColumnSortingChange] = useControlledSlice(initial)
  return { sorting, onColumnSortingChange }
}

export const useRowSelectionState = (
  initial: RowSelectionState = EMPTY_SELECTION,
) => {
  const [rowSelection, onRowSelectionChange] = useControlledSlice(initial)
  return { rowSelection, onRowSelectionChange }
}

export const useRowExpandingState = (initial: ExpandedState = EMPTY_EXPANDED) => {
  const [rowExpanded, onRowExpandedChange] = useControlledSlice(initial)
  return { rowExpanded, onRowExpandedChange }
}

export const useRowGroupingState = (initial: GroupingState = EMPTY_GROUPING) => {
  const [grouping, onGroupingChange] = useControlledSlice(initial)
  return { grouping, onGroupingChange }
}

// --- Публичный stateUpdater (совместимость API) -------------------------------

/**
 * Обёртка для построения updater'а среза состояния (совместимость с v8-API). В v9
 * состояние живёт в атомах — используем штатный `makeStateUpdater(key, table)`.
 */
export const stateUpdater = <
  TFeatures extends TableFeatures,
  TData extends RowData,
  K extends keyof TableState<TFeatures> & string,
>(
  key: K,
  table: Table<TFeatures, TData>,
) => makeStateUpdater(key as never, table as never)
