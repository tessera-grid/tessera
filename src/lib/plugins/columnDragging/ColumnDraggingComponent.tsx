/**
 * Слот-ручка перетаскивания столбца. Реактивность на срезе `columnDraggingActiveId`
 * (`useSlice`); у закреплённого узла (зона листьев) ручки нет (ADR 0114). Переиспользуем
 * grid-компонент DragHandler. Хуки не читает — колбэк живёт в dnd-редьюсере и
 * `moveColumn`. Клик по ручке — меню «Move left / right» (ADR 0034, DA1) — и у
 * группы (ADR 0052, ND5).
 */
import type { HeaderComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useSlice, useTableState } from '../../core/reactivity'
import { DragHandler } from '../../shared/dnd'
import {
  type ColumnMoveDirection,
  canMoveColumn,
  moveColumn,
} from './moveColumn'
import { zoneOf } from '../../core/columnNodes'
import { columnDraggingLabels } from './labels'

export const ColumnDraggingComponent = ({
  header,
  column,
  table,
}: HeaderComponentProps) => {
  // Всегда-присутствующий срез плагина (реактивность dnd).
  useSlice(table, 'columnDraggingActiveId')
  const labels = useLocalization()

  // Ожидание переноса (ADR 0114) — только этого узла: меню ручки не открывается.
  const busy = useTableState(
    table,
    (state: unknown) =>
      !!(state as { columnMoves?: Record<string, unknown> }).columnMoves?.[
        column.id
      ],
  ) as boolean

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
      label={columnDraggingLabels(labels).moveColumn}
      table={table}
      getMenuItems={() => [
        item('moveLeft', columnDraggingLabels(labels).moveLeft, -1),
        item('moveRight', columnDraggingLabels(labels).moveRight, 1),
      ]}
    />
  )
}
