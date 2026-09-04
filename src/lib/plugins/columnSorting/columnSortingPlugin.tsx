import { TablePlugin } from '../types'

// Поведение сортировки обеспечивает встроенная фича TanStack (RowSorting) +
// опция `enableSorting`; кнопка сортировки объявлена декларативно в записи
// реестра (`registry.ts`), поэтому фиче здесь нечего добавлять к инстансу.
export const columnSortingPlugin: TablePlugin = {}
