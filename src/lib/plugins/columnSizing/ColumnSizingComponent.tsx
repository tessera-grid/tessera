/**
 * Фаза E — ручка ресайза колонки (v9-порт ColumnSizingComponent).
 * Реактивность на `useSelector(table.atoms.columnResizing)` (в v9 state ресайза
 * переименован columnSizingInfo→columnResizing) вместо useSubscribeStore.
 * Методы колонки/заголовка в v9 те же имена.
 */
import { useSelector } from '@tanstack/react-store'

import type { HeaderComponentProps } from '../../core/createSlots'
import { ResizeHandler } from '../../plugins/columnSizing/ResizeHandler'
import type { ColumnSizingPlugin } from './types'

export const ColumnSizingComponent = ({
  header,
  column,
  table,
}: HeaderComponentProps) => {
  useSelector((table as unknown as { atoms: { columnResizing: unknown } }).atoms.columnResizing as never)

  if (!column.getCanResize()) {
    return null
  }

  const hooks = () => (table.getHooks() as ColumnSizingPlugin).columnSizing

  const onResetSize = () => {
    const { minSize, size, maxSize } = column.columnDef

    column.resetSize()

    const width = Math.min(
      Math.max(minSize ?? 20, size ?? 150),
      maxSize ?? Number.MAX_SAFE_INTEGER,
    )

    hooks().onColumnResizeEnd?.({ id: column.id, width })
  }

  const onResizeEnd = () => {
    hooks().onColumnResizeEnd?.({ id: column.id, width: column.getSize() })
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
