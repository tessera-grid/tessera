import { useEffect } from 'react'

import { Table } from '@tanstack/react-table'

export interface UseRowSelectionResetParams<TData> {
  table: Table<TData>
}

// Сброс выбора строк при смене опций выбора — ядровая логика (использует только
// table.resetRowSelection, без зависимостей от плагинов). Перенесено в ядро из
// plugins/rowSelection при инверсии (ADR 0010).
export const useRowSelectionReset = <TData>({
  table,
}: UseRowSelectionResetParams<TData>) => {
  useEffect(() => {
    table.resetRowSelection(true)
  }, [
    table,
    table.options.enableRowSelection,
    table.options.enableSubRowSelection,
    table.options.manualExpanding,
  ])
}
