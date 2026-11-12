/**
 * Ручка ресайза колонки: реактивность на срезе `columnResizing` (`useSlice`) и
 * на ширине своей колонки; бизнес-колбэк — из пропса `hooks` (инъекция
 * definePlugin).
 */
import { reportAction } from '../../core/debugActions'
import { useEffect } from 'react'

import {
  cancelColumnResize,
  type SessionCancelReason,
} from '../../core/cancelInteraction'
import type { PluginHeaderProps } from '../../core/definePlugin'
import { useSlice, useTableState } from '../../core/reactivity'
import { useLatest } from '../../util/useLatest'
import { ResizeHandler } from '../../plugins/columnSizing/ResizeHandler'
import type { ColumnSizingHooks } from './types'
import { autosizeColumns } from './autosize'

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
  const latest = useLatest({ table, isResizing })
  // Ручка ушла посреди протяжки (грид размонтирован) — цель недоступна.
  useEffect(
    () => () => {
      if (latest.current.isResizing) {
        cancelColumnResize(latest.current.table, 'unavailable')
      }
    },
    [latest],
  )

  if (!canResize) {
    return null
  }

  const onResetSize = () => {
    const { minSize, size, maxSize } = column.columnDef

    column.resetSize()
    ;(
      table as unknown as {
        setColumnFlexMinSizing: (
          updater: (old: Record<string, number>) => Record<string, number>,
        ) => void
      }
    ).setColumnFlexMinSizing(({ [column.id]: _removed, ...rest }) => rest)

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
    reportAction(table, {
      plugin: 'columnSizing',
      action: 'resize',
      detail: { columnId: column.id, width: column.getSize() },
      source: 'pointer',
      phase: 'end',
    })
    hooks.onColumnResizeEnd({ id: column.id, width: column.getSize() })
  }

  const onResizeCancel = (reason: SessionCancelReason) => {
    reportAction(table, {
      plugin: 'columnSizing',
      action: 'resizeCancel',
      detail: { columnId: column.id, reason },
      source: 'pointer',
      phase: 'end',
    })
    hooks.onColumnResizeCancel?.({ columnId: column.id, reason })
  }

  return (
    <ResizeHandler
      isResizing={column.getIsResizing()}
      onResize={event => {
        reportAction(table, {
          plugin: 'columnSizing',
          action: 'resize',
          detail: { columnId: column.id, width: column.getSize() },
          source: 'pointer',
          phase: 'start',
        })
        header.getResizeHandler()(event)
      }}
      columnId={column.id}
      onResizeEnd={onResizeEnd}
      onResizeCancel={onResizeCancel}
      onEscape={() => cancelColumnResize(table, 'cancel')}
      onResetSize={onResetSize}
      onResizeBy={onResizeBy}
      onAutosize={source => void autosizeColumns(table, [column.id], source)}
      onAutosizeAll={source => void autosizeColumns(table, undefined, source)}
      size={column.getSize()}
      minSize={minSize}
      maxSize={upperBound}
      table={table}
    />
  )
}
