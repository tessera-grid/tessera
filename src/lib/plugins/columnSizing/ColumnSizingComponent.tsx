/**
 * Ручка ресайза колонки: реактивность на срезе `columnResizing` (`useSlice`);
 * бизнес-колбэк — из пропса `hooks` (инъекция definePlugin).
 */
import type { PluginHeaderProps } from '../../core/definePlugin'
import { useSlice } from '../../core/reactivity'
import { ResizeHandler } from '../../plugins/columnSizing/ResizeHandler'
import type { ColumnSizingHooks } from './types'

export const ColumnSizingComponent = ({
  header,
  column,
  table,
  hooks,
}: PluginHeaderProps<ColumnSizingHooks>) => {
  useSlice(table, 'columnResizing')

  if (!column.getCanResize()) {
    return null
  }

  const onResetSize = () => {
    const { minSize, size, maxSize } = column.columnDef

    column.resetSize()

    const width = Math.min(
      Math.max(minSize ?? 20, size ?? 150),
      maxSize ?? Number.MAX_SAFE_INTEGER,
    )

    hooks.onColumnResizeEnd({ id: column.id, width })
  }

  const onResizeEnd = () => {
    hooks.onColumnResizeEnd({ id: column.id, width: column.getSize() })
  }

  return (
    <ResizeHandler
      isResizing={column.getIsResizing()}
      onResize={header.getResizeHandler()}
      onResizeEnd={onResizeEnd}
      onResetSize={onResetSize}
    />
  )
}
