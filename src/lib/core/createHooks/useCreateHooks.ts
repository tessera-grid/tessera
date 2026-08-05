import { useMemo } from 'react'

import { PluginsHooks } from './types'

const defaultHooks: PluginsHooks = {
  columnDragging: { onColumnDragEnd: () => null },
  columnPinning: { onTogglePin: () => null },
  columnSizing: { onColumnResizeEnd: () => null },
  columnSorting: { onToggleColumnSort: () => null },
  rowSelection: {
    onSelectRow: () => null,
    onSelectAllRowsOnPage: () => null,
    isAllRowsSelected: false,
  },
  rowExpanding: {
    onExpandRow: () => Promise.resolve(),
  },
  rowDragging: { onRowDragEnd: () => null },
}

/**
 * Функция реализации API-контракта между плагинами и внешним миром.
 */
export const useCreateHooks = <THooks = any>(
  hooks: Partial<PluginsHooks> & THooks,
): PluginsHooks & THooks => {
  return useMemo(
    () => ({
      ...defaultHooks,
      ...hooks,
    }),
    [hooks],
  )
}
