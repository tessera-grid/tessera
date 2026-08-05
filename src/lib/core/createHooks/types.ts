import type { ColumnDraggingPlugin } from '../../plugins/columnDragging'
import type { ColumnPinningPlugin } from '../../plugins/columnPinning'
import type { ColumnSizingPlugin } from '../../plugins/columnSizing'
import type { ColumnSortingPlugin } from '../../plugins/columnSorting'
import type { RowDraggingPlugin } from '../../plugins/rowDragging'
import type { RowExpandingPlugin } from '../../plugins/rowExpanding'
import type { RowSelectionPlugin } from '../../plugins/rowSelection'

export type PluginsHooks = ColumnDraggingPlugin &
  ColumnPinningPlugin &
  ColumnSizingPlugin &
  ColumnSortingPlugin &
  RowSelectionPlugin &
  RowExpandingPlugin &
  RowDraggingPlugin
