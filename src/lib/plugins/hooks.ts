import type { ColumnDraggingPlugin } from './columnDragging/types'
import type { ColumnPinningPlugin } from './columnPinning/types'
import type { ColumnSizingPlugin } from './columnSizing/types'
import type { ColumnSortingPlugin } from './columnSorting/types'
import type { RowDraggingPlugin } from './rowDragging/types'
import type { RowExpandingPlugin } from './rowExpanding/types'
import type { RowSelectionPlugin } from './rowSelection/types'

// Слайсы встроенных плагинов реэкспортируются как публичные примитивы: потребитель
// собирает нужный набор вручную (presence-based) либо берёт агрегат ниже.
export type {
  ColumnDraggingPlugin,
  ColumnPinningPlugin,
  ColumnSizingPlugin,
  ColumnSortingPlugin,
  RowDraggingPlugin,
  RowExpandingPlugin,
  RowSelectionPlugin,
}

/**
 * Union всех встроенных hook-слайсов (types-mode b, ADR 0010). Живёт во входе
 * `@mstrvtt/tessera/plugins`, а не в ядре — стрелка зависимости смотрит вверх
 * (агрегат знает плагины; ядро — нет). Нужен для вызовов `useCreateTable` с
 * ЯВНЫМИ generic-аргументами, где вывод хуков из кортежа `plugins` не срабатывает:
 * `useCreateTable<Data, BuiltinPluginsHooks & MyHooks, …>({ … })`. В вызове без
 * явных дженериков тип хуков выводится автоматически — агрегат не нужен.
 */
export type BuiltinPluginsHooks = ColumnDraggingPlugin &
  ColumnPinningPlugin &
  ColumnSizingPlugin &
  ColumnSortingPlugin &
  RowSelectionPlugin &
  RowExpandingPlugin &
  RowDraggingPlugin
