/**
 * Слот-ручка перетаскивания столбца. Реактивность на срезе `columnDraggingActiveId`
 * (`useSlice`); у закреплённого узла (зона листьев) ручки нет (ADR 0114). Переиспользуем
 * grid-компонент DragHandler. Хуки не читает — колбэк живёт в dnd-редьюсере и
 * `moveColumn`. Клик по ручке — меню «Move left / right» (ADR 0034, DA1) — и у
 * группы (ADR 0052, ND5).
 */
import type { HeaderComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import type { FailedAttempt } from '../../shared/failedAttempts'
import { rejectionText } from '../../util/thenable'
import { useSlice, useTableState } from '../../core/reactivity'
import { DragHandler } from '../../grid/dnd'
import {
  type ColumnMoveDirection,
  canMoveColumn,
  moveColumn,
} from './moveColumn'
import { zoneOf } from '../../core/columnNodes'

export const ColumnDraggingComponent = ({
  header,
  column,
  table,
}: HeaderComponentProps) => {
  // Всегда-присутствующий срез плагина (реактивность dnd).
  useSlice(table, 'columnDraggingActiveId')
  const labels = useLocalization()

  // Ожидание и отказ переноса (ADR 0114) — только этого узла.
  const { busy, failed } = useTableState(table, (state: unknown) => {
    const s = state as {
      columnMoves?: Record<string, unknown>
      columnMoveFailed?: Record<string, FailedAttempt>
    }
    return {
      busy: !!s.columnMoves?.[column.id],
      failed: s.columnMoveFailed?.[column.id],
    }
  }) as { busy: boolean; failed?: FailedAttempt }

  if (!column.getCanDrag() || zoneOf(header as never) !== false) {
    return null
  }

  const item = (id: string, label: string, direction: ColumnMoveDirection) => ({
    id,
    label,
    disabled: !canMoveColumn(table, header, direction),
    onSelect: () => moveColumn(table, header, direction),
  })

  return (
    <DragHandler
      id={column.id}
      type="column"
      busy={busy}
      failure={
        failed &&
        labels.actionFailedRetry(
          rejectionText(failed.error) ?? labels.moveColumnFailed,
        )
      }
      label={labels.moveColumn}
      table={table}
      getMenuItems={() => [
        item('moveLeft', labels.moveLeft, -1),
        item('moveRight', labels.moveRight, 1),
      ]}
    />
  )
}
