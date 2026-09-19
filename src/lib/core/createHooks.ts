/**
 * Always-on no-op дефолты бизнес-контракта хуков (ADR 0010). Гарантируют, что
 * чтение любого встроенного слайса хуков не упадёт, даже если потребитель его не
 * передал. Литералы, а не импорт плагинов.
 */
import { useMemo } from 'react'

const defaultHooks = {
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

export type PluginsHooks = typeof defaultHooks

export const useCreateHooks = <THooks extends object = Record<never, never>>(
  hooks: Partial<THooks> = {},
): THooks => useMemo(() => ({ ...defaultHooks, ...hooks }) as THooks, [hooks])
