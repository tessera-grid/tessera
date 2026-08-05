import { useEffect, useMemo, useState } from 'react'

import {
  ColumnPinningState,
  OnChangeFn,
  TableOptions,
} from '@tanstack/react-table'

import { COLUMN_DRAGGING_ID } from '../../plugins/rowDragging'
import { COLUMN_EXPANDING_ID } from '../../plugins/rowExpanding'
import { COLUMN_SELECTION_ID } from '../../plugins/rowSelection'
import { ROW_ACTIONS_COLUMN_ID } from '../createColumns'

export const mergeColumnPinning = (
  prevColumnPinning: ColumnPinningState | undefined,
  nextColumnPinning: ColumnPinningState | undefined,
): ColumnPinningState => {
  return {
    left: [
      ...new Set([
        ...(prevColumnPinning?.left || []),
        ...(nextColumnPinning?.left || []),
      ]),
    ],
    right: [
      ...new Set([
        ...(prevColumnPinning?.right || []),
        ...(nextColumnPinning?.right || []),
      ]),
    ],
  }
}

interface UseColumnPinningInitialStateParams<TData> {
  enableRowSelection: TableOptions<TData>['enableRowSelection']
  enableRowExpanding: TableOptions<TData>['enableRowExpanding']
  enableRowDragging: TableOptions<TData>['enableRowDragging']
  enableRowActions: TableOptions<TData>['enableRowActions']
}

export const useColumnPinningInitialState = <TData>({
  enableRowExpanding,
  enableRowSelection,
  enableRowDragging,
  enableRowActions,
}: UseColumnPinningInitialStateParams<TData>) => {
  const actionLeftColumnsPinning: ColumnPinningState = useMemo(() => {
    let left: ColumnPinningState['left'] = []

    if (enableRowExpanding) {
      left = [COLUMN_EXPANDING_ID, ...left]
    }

    if (enableRowSelection) {
      left = [COLUMN_SELECTION_ID, ...left]
    }

    if (enableRowDragging) {
      left = [COLUMN_DRAGGING_ID, ...left]
    }

    return {
      left,
      right: [],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!enableRowDragging, !!enableRowExpanding, !!enableRowSelection])

  const actionRightColumnsPinning: ColumnPinningState = useMemo(() => {
    let right: ColumnPinningState['right'] = []

    if (enableRowActions) {
      right = [...right, ROW_ACTIONS_COLUMN_ID]
    }

    return {
      left: [],
      right,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!enableRowActions])

  return { actionLeftColumnsPinning, actionRightColumnsPinning }
}

export const defaultColumnPinningState: ColumnPinningState = {
  left: [],
  right: [],
}

export interface ColumnPinningStateReturnType {
  columnPinning: ColumnPinningState
  onColumnPinningChange: OnChangeFn<ColumnPinningState>
}

export const useColumnPinningState = (
  initialColumnPinningState = defaultColumnPinningState,
): ColumnPinningStateReturnType => {
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
    mergeColumnPinning(defaultColumnPinningState, initialColumnPinningState),
  )

  useEffect(() => {
    setColumnPinning(
      mergeColumnPinning(defaultColumnPinningState, initialColumnPinningState),
    )
  }, [initialColumnPinningState])

  return { columnPinning, onColumnPinningChange: setColumnPinning }
}
