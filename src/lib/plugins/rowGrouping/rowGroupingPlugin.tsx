import { TablePlugin } from '../types'

// Поведение группировки обеспечивает встроенная фича TanStack (ColumnGrouping) +
// опция `enableGrouping`; кнопка группировки объявлена декларативно в записи
// реестра (`registry.ts`).
export const rowGroupingPlugin: TablePlugin = {}
