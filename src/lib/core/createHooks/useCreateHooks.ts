import { useMemo } from 'react'

// Always-on no-op дефолты хуков — инфраструктура ядра: гарантируют, что чтение
// любого встроенного слайса не упадёт, даже если потребитель его не передал.
// Это литералы, а не импорт плагинов (R1-чисто) — типы слайсов ядру не нужны.
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

/**
 * Слить пользовательские хуки с always-on дефолтами ядра. Тип возврата — то, что
 * передал вызывающий: встроенные слайсы он типизирует через набор `plugins`
 * (`useCreateTable`) либо объявляет сам; ядро лишь подкладывает no-op дефолты.
 */
export const useCreateHooks = <THooks extends object = Record<never, never>>(
  hooks: Partial<THooks> = {},
): THooks => useMemo(() => ({ ...defaultHooks, ...hooks }) as THooks, [hooks])
