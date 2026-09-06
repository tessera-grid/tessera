import { useCallback, useMemo } from 'react'

import {
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
  TableState,
  functionalUpdate,
} from '@tanstack/react-table'

import { useColumnOrderState } from './columnOrderState'
import {
  mergeServiceColumnPinning,
  useColumnPinningState,
} from './columnPinningState'
import { useColumnSizingState } from './columnSizingState'
import { useColumnSortingState } from './columnSortingState'
import { useColumnVisibilityState } from './columnVisibilityState'
import { useRowExpandingState } from './rowExpandingState'
import { useRowGroupingState } from './rowGroupingState'
import { useRowSelectionState } from './rowSelectionState'
import { CreateStateParams } from './types'

// Поверхностное сравнение слайсов размеров (для бейла авто-слайса при равенстве).
const isSameColumnSizing = (
  a: ColumnSizingState,
  b: ColumnSizingState,
): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(key => a[key] === b[key])
}

export const useCreateState = <
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
>({
  columns,
  state,
  handlers,
  serviceColumns,
}: CreateStateParams<TData, THooks, TState, TOptions>): {
  coreState: Partial<TableState>
  externalState: any
  coreHandlers: any
  externalHandlers: any
} => {
  const {
    columnSizing: externalColumnSizing,
    columnOrder: externalColumnOrder,
    sorting: externalSorting,
    columnPinning: externalColumnPinning,
    rowSelection: externalRowSelection,
    columnVisibility: externalColumnVisibility,
    expanded: externalExpanded,
    grouping: externalGrouping,
    ...externalState
  } = state

  const {
    onColumnOrderChange: onColumnOrderExternalChange,
    onColumnPinningChange: onColumnPinningExternalChange,
    onColumnVisibilityChange: onColumnVisibilityExternalChange,
    onColumnSortingChange: onColumnSortingExternalChange,
    onColumnSizingChange: onColumnSizingExternalChange,
    onRowSelectionChange: onRowSelectionExternalChange,
    onRowExpandedChange: onRowExpandedExternalChange,
    onRowOrderChange,
    onGroupingChange: onGroupingExternalChange,
    ...externalHandlers
  } = handlers

  /** COLUMN ORDERING */

  const initialColumnOrder = useMemo(
    () => columns.map(column => column.id).filter((id): id is string => !!id),
    [columns],
  )

  const { columnOrder, onColumnOrderChange } =
    useColumnOrderState(initialColumnOrder)

  /** COLUMN VISIBILITY */

  // Видимость сервисных колонок сеется по их наличию: колонка есть в наборе
  // (плагин присутствует) → она видима. Ядро не знает конкретных плагинов —
  // только список сервисных колонок (ADR 0010, R8/R10).
  const initialColumnVisibility = useMemo(
    () =>
      serviceColumns.reduce<Record<string, boolean>>((acc, column) => {
        acc[column.id] = true
        return acc
      }, {}),
    [serviceColumns],
  )

  const { columnVisibility, onColumnVisibilityChange } =
    useColumnVisibilityState()

  const mergedColumnVisibility = useMemo(() => {
    return {
      ...(externalColumnVisibility ?? columnVisibility),
      ...initialColumnVisibility,
    }
  }, [columnVisibility, externalColumnVisibility, initialColumnVisibility])

  /** COLUMN SIZING */

  const {
    columnSizing: columnAutoSizing,
    onColumnSizingChange: setColumnAutoSizing,
  } = useColumnSizingState()

  // Авто-слайс размеров пишут плагины в `setup` (generic-escape ADR 0010), а
  // `setup` ядро запускает при каждой смене идентичности списка плагинов — а она
  // нестабильна (потребитель обычно отдаёт новый массив каждый рендер). Поэтому
  // writer бейлит при равенстве (возвращает prev → React пропускает рендер),
  // иначе идемпотентная запись той же ширины крутила бы бесконечный цикл.
  const onColumnAutoSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
    updater =>
      setColumnAutoSizing(prev => {
        const next = functionalUpdate(updater, prev)
        return isSameColumnSizing(prev, next) ? prev : next
      }),
    [setColumnAutoSizing],
  )

  const { columnSizing, onColumnSizingChange } = useColumnSizingState()

  const mergedColumnSizing = useMemo(() => {
    return { ...(externalColumnSizing ?? columnSizing), ...columnAutoSizing }
  }, [columnAutoSizing, columnSizing, externalColumnSizing])

  /** COLUMN PINNING */

  const { columnPinning, onColumnPinningChange } = useColumnPinningState()

  // Хранимый пиннинг — ТОЛЬКО пользовательский (без сервисных колонок). Пиннинг
  // сервисных колонок — политика плагинов, применяется как display-трансформ на
  // выходе в TanStack (ADR 0010, R10). Так `when:'with-user'` считается по
  // реальным пользовательским пинам, а сервисные id не протекают в стор.
  const userColumnPinning = externalColumnPinning ?? columnPinning
  const setUserColumnPinning =
    onColumnPinningExternalChange ?? onColumnPinningChange

  const mergedColumnPinning = useMemo(
    () => mergeServiceColumnPinning(userColumnPinning, serviceColumns),
    [userColumnPinning, serviceColumns],
  )

  const serviceColumnIds = useMemo(
    () => serviceColumns.map(column => column.id),
    [serviceColumns],
  )

  const handleColumnPinningChange = useCallback<OnChangeFn<ColumnPinningState>>(
    updater =>
      setUserColumnPinning(prev => {
        // prev — чистый пользовательский пиннинг; реконструируем отображаемый
        // (со сервисными), применяем апдейт TanStack, срезаем сервисные обратно.
        const displayed = mergeServiceColumnPinning(prev, serviceColumns)
        const next = functionalUpdate(updater, displayed)
        return {
          left: (next.left ?? []).filter(id => !serviceColumnIds.includes(id)),
          right: (next.right ?? []).filter(
            id => !serviceColumnIds.includes(id),
          ),
        }
      }),
    [setUserColumnPinning, serviceColumns, serviceColumnIds],
  )

  /** COLUMN SORTING */

  const { columnSorting, onColumnSortingChange } = useColumnSortingState()

  /** ROWS SELECTION */

  const { rowSelection, onRowSelectionChange } = useRowSelectionState()

  /** COLUMN EXPANDING */

  const { rowExpanded, onRowExpandedChange } = useRowExpandingState()

  /** GROUPING */

  const { grouping, onGroupingChange } = useRowGroupingState()

  // Drag-оверлеи (columnDraggingActiveId / rowDragging) больше не управляются
  // ядром — их сеют и обновляют сами плагины через getInitialState/
  // getDefaultOptions, а TanStack держит слайсы как uncontrolled (ADR 0010).

  return {
    coreState: {
      columnSizing: mergedColumnSizing,
      columnOrder: externalColumnOrder || columnOrder,
      sorting: externalSorting || columnSorting,
      columnPinning: mergedColumnPinning,
      rowSelection: externalRowSelection || rowSelection,
      columnVisibility: mergedColumnVisibility,
      expanded: externalExpanded || rowExpanded,
      grouping: externalGrouping || grouping,
    },
    externalState,
    coreHandlers: {
      onRowSelectionChange:
        onRowSelectionExternalChange || onRowSelectionChange,
      onColumnPinningChange: handleColumnPinningChange,
      onColumnOrderChange: onColumnOrderExternalChange || onColumnOrderChange,
      onRowOrderChange,
      onColumnSizingChange:
        onColumnSizingExternalChange || onColumnSizingChange,
      onColumnVisibilityChange:
        onColumnVisibilityExternalChange || onColumnVisibilityChange,
      onSortingChange: onColumnSortingExternalChange || onColumnSortingChange,
      onExpandedChange: onRowExpandedExternalChange || onRowExpandedChange,
      onColumnAutoSizingChange,
      onGroupingChange: onGroupingExternalChange || onGroupingChange,
    },
    externalHandlers,
  }
}
