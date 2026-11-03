/**
 * Always-on no-op дефолты бизнес-контракта хуков. Гарантируют, что
 * чтение любого встроенного слайса хуков не упадёт, даже если плагин его не задал.
 * Литералы, а не импорт плагинов.
 */
const defaultHooks = {
  columnDragging: { onColumnDragEnd: () => null },
  columnPinning: { onTogglePin: () => null },
  columnSizing: { onColumnResizeEnd: () => null },
  columnSorting: { onToggleColumnSort: () => null },
  rowSelection: {
    onSelectRow: () => null,
    onSelectAllRows: () => null,
    isAllRowsSelected: false,
  },
  rowExpanding: {
    onExpandRow: () => null,
  },
  rowDragging: { onRowDragEnd: () => null },
}

export type PluginsHooks = typeof defaultHooks

/**
 * Чистое разрешение бизнес-контракта хуков: слияние с no-op дефолтами ПО SCOPE
 * (не поверхностное сверху), чтобы частичный слайс (напр. только `onSelectRow` из
 * аргументов фабрики плагина) дополнялся дефолтами остальных ключей scope, а не
 * затирал их. Кастомные scope без дефолта берутся как есть.
 */
export const resolveHooks = <THooks extends object = Record<never, never>>(
  hooks: Partial<THooks> = {},
): THooks => {
  const provided = hooks as Record<string, Record<string, unknown> | undefined>
  const merged: Record<string, unknown> = {}
  const scopes = new Set([
    ...Object.keys(defaultHooks),
    ...Object.keys(provided),
  ])
  for (const scope of scopes) {
    merged[scope] = {
      ...(defaultHooks as Record<string, object>)[scope],
      ...provided[scope],
    }
  }
  return merged as THooks
}
