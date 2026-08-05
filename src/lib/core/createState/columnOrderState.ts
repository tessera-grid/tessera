import { useEffect, useState } from 'react'

import { ColumnOrderState, OnChangeFn } from '@tanstack/react-table'

export const defaultColumnOrderState: ColumnOrderState = []

export interface ColumnOrderStateReturnType {
  columnOrder: ColumnOrderState
  onColumnOrderChange: OnChangeFn<ColumnOrderState>
}

export const useColumnOrderState = (
  initialColumnOrderState = defaultColumnOrderState,
): ColumnOrderStateReturnType => {
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    initialColumnOrderState,
  )

  useEffect(() => {
    // Важно! Инициализируем массив порядка колонок только один раз, либо если их количество изменилось
    if (columnOrder.length !== initialColumnOrderState.length) {
      setColumnOrder(initialColumnOrderState)
    }
  }, [columnOrder.length, initialColumnOrderState])

  return { columnOrder, onColumnOrderChange: setColumnOrder }
}
