import { TablePlugin } from '../types'

// Поведение ресайза обеспечивает встроенная фича TanStack (ColumnSizing) +
// опции `enableColumnResizing`/`columnResizeMode`; ручка ресайза объявлена
// декларативно в записи реестра (`registry.ts`).
export const columnSizingPlugin: TablePlugin = {}
