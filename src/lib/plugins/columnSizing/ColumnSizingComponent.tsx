/**
 * Ручка ресайза колонки: реактивность на срезе `columnResizing` (`useSlice`) и
 * на ширине своей колонки; бизнес-колбэк — из пропса `hooks` (инъекция
 * definePlugin).
 */
import { useEffect, useRef } from 'react'

import {
  cancelColumnResize,
  type SessionCancelReason,
} from '../../core/cancelInteraction'
import type { PluginHeaderProps } from '../../core/definePlugin'
import { useSlice, useTableState } from '../../core/reactivity'
import { ResizeHandler } from '../../plugins/columnSizing/ResizeHandler'
import type { ColumnSizingHooks } from './types'

export const ColumnSizingComponent = ({
  header,
  column,
  table,
  hooks,
}: PluginHeaderProps<ColumnSizingHooks>) => {
  useSlice(table, 'columnResizing')
  useTableState(
    table,
    state =>
      (state as { columnSizing?: Record<string, number> }).columnSizing?.[
        column.id
      ],
  )

  // Ресайз запретили посреди протяжки (колонка, плагин) — отмена как по Escape:
  // ширина возвращается к исходной, бизнес-колбэк не зовётся (ADR 0039, RX15).
  const canResize = column.getCanResize()
  const isResizing = column.getIsResizing()
  useEffect(() => {
    if (isResizing && !canResize) {
      cancelColumnResize(table, 'revoke')
    }
  }, [isResizing, canResize, table])
  const latest = useRef({ table, isResizing })
  latest.current = { table, isResizing }
  // Ручка ушла посреди протяжки (грид размонтирован) — цель недоступна.
  useEffect(
    () => () => {
      if (latest.current.isResizing) {
        cancelColumnResize(latest.current.table, 'unavailable')
      }
    },
    [],
  )

  if (!canResize) {
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

  const { minSize = 20, maxSize } = column.columnDef
  const upperBound =
    maxSize !== undefined && maxSize < Number.MAX_SAFE_INTEGER
      ? maxSize
      : undefined

  const onResizeBy = (delta: number) => {
    const width = Math.min(
      Math.max(column.getSize() + delta, minSize),
      upperBound ?? Number.MAX_SAFE_INTEGER,
    )
    table.setColumnSizing(old => ({ ...old, [column.id]: width }))
    hooks.onColumnResizeEnd({ id: column.id, width })
  }

  const onResizeEnd = () => {
    hooks.onColumnResizeEnd({ id: column.id, width: column.getSize() })
  }

  const onResizeCancel = (reason: SessionCancelReason) => {
    hooks.onColumnResizeCancel?.({ columnId: column.id, reason })
  }

  return (
    <ResizeHandler
      isResizing={column.getIsResizing()}
      onResize={header.getResizeHandler()}
      onResizeEnd={onResizeEnd}
      onResizeCancel={onResizeCancel}
      onEscape={() => cancelColumnResize(table, 'cancel')}
      onResetSize={onResetSize}
      onResizeBy={onResizeBy}
      size={column.getSize()}
      minSize={minSize}
      maxSize={upperBound}
    />
  )
}
