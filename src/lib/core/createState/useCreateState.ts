import { useMemo, useState } from 'react'

import { TableState } from '@tanstack/react-table'

import { DragOverlayState } from '../../plugins/columnDragging'
import { RowDragOverlayState } from '../../plugins/rowDragging'
import { DEFAULT_ROW_DRAG_OVERLAY_STATE } from '../../plugins/rowDragging/types'
import { COLUMN_EXPANDING_ID } from '../../plugins/rowExpanding'
import { COLUMN_SELECTION_ID } from '../../plugins/rowSelection'
import { ROW_ACTIONS_COLUMN_ID } from '../createColumns/createRowActionsColumn'
import { useColumnOrderState } from './columnOrderState'
import {
  mergeColumnPinning,
  useColumnPinningInitialState,
  useColumnPinningState,
} from './columnPinningState'
import { useColumnSizingState } from './columnSizingState'
import { useColumnSortingState } from './columnSortingState'
import { useColumnVisibilityState } from './columnVisibilityState'
import { useRowExpandingState } from './rowExpandingState'
import { useRowGroupingState } from './rowGroupingState'
import { useRowSelectionState } from './rowSelectionState'
import { CreateStateParams } from './types'

export const useCreateState = <
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
>({
  columns,
  state,
  handlers,
  enableRowSelection,
  enableRowExpanding,
  enableRowDragging,
  enableRowActions,
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

  const initialColumnVisibility = useMemo(
    () => ({
      [COLUMN_SELECTION_ID]: !!enableRowSelection,
      [COLUMN_EXPANDING_ID]: !!enableRowExpanding,
      [ROW_ACTIONS_COLUMN_ID]: !!enableRowActions,
    }),
    [enableRowActions, enableRowExpanding, enableRowSelection],
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
    onColumnSizingChange: onColumnAutoSizingChange,
  } = useColumnSizingState()

  const { columnSizing, onColumnSizingChange } = useColumnSizingState()

  const mergedColumnSizing = useMemo(() => {
    return { ...(externalColumnSizing ?? columnSizing), ...columnAutoSizing }
  }, [columnAutoSizing, columnSizing, externalColumnSizing])

  /** COLUMN PINNING */

  const { actionLeftColumnsPinning, actionRightColumnsPinning } =
    useColumnPinningInitialState({
      enableRowExpanding,
      enableRowSelection,
      enableRowDragging,
      enableRowActions,
    })

  const { columnPinning, onColumnPinningChange } = useColumnPinningState()

  const mergedColumnPinning = useMemo(() => {
    const externalUserColumnsLeftPinningExist =
      externalColumnPinning !== undefined &&
      Array.isArray(externalColumnPinning.left) &&
      externalColumnPinning.left.length > 0

    const userColumnsLeftPinningExist =
      Array.isArray(columnPinning.left) && columnPinning.left.length > 0

    if (externalUserColumnsLeftPinningExist || userColumnsLeftPinningExist) {
      const actionColumnsPinning = mergeColumnPinning(
        actionLeftColumnsPinning,
        actionRightColumnsPinning,
      )

      return mergeColumnPinning(
        actionColumnsPinning,
        externalColumnPinning ?? columnPinning,
      )
    }

    return mergeColumnPinning(
      externalColumnPinning ?? columnPinning,
      actionRightColumnsPinning,
    )
  }, [
    actionLeftColumnsPinning,
    actionRightColumnsPinning,
    columnPinning,
    externalColumnPinning,
  ])

  /** COLUMN SORTING */

  const { columnSorting, onColumnSortingChange } = useColumnSortingState()

  /** ROWS SELECTION */

  const { rowSelection, onRowSelectionChange } = useRowSelectionState()

  /** COLUMN EXPANDING */

  const { rowExpanded, onRowExpandedChange } = useRowExpandingState()

  /** GROUPING */

  const { grouping, onGroupingChange } = useRowGroupingState()

  /** COLUMN/ROWS DRAGGING */

  const [columnDraggingActiveId, setColumnDraggingActiveId] =
    useState<DragOverlayState>(null)

  const [rowDragging, setRowDragging] = useState<RowDragOverlayState>(
    DEFAULT_ROW_DRAG_OVERLAY_STATE,
  )

  return {
    coreState: {
      columnSizing: mergedColumnSizing,
      columnOrder: externalColumnOrder || columnOrder,
      sorting: externalSorting || columnSorting,
      columnPinning: mergedColumnPinning,
      rowSelection: externalRowSelection || rowSelection,
      columnVisibility: mergedColumnVisibility,
      expanded: externalExpanded || rowExpanded,
      columnDraggingActiveId,
      rowDragging,
      grouping: externalGrouping || grouping,
    },
    externalState,
    coreHandlers: {
      onRowSelectionChange:
        onRowSelectionExternalChange || onRowSelectionChange,
      onColumnPinningChange:
        onColumnPinningExternalChange || onColumnPinningChange,
      onColumnOrderChange: onColumnOrderExternalChange || onColumnOrderChange,
      onRowOrderChange,
      onColumnSizingChange:
        onColumnSizingExternalChange || onColumnSizingChange,
      onColumnVisibilityChange:
        onColumnVisibilityExternalChange || onColumnVisibilityChange,
      onSortingChange: onColumnSortingExternalChange || onColumnSortingChange,
      onExpandedChange: onRowExpandedExternalChange || onRowExpandedChange,
      onColumnDraggingActiveIdChange: setColumnDraggingActiveId,
      onRowDraggingChange: setRowDragging,
      onColumnAutoSizingChange,
      onGroupingChange: onGroupingExternalChange || onGroupingChange,
    },
    externalHandlers,
  }
}
