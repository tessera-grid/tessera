/**
 * Ячейка-ручка перетаскивания строки. Реактивность на всегда-присутствующий срез
 * `rowDragging`. Переиспользуем grid-компонент DragHandler. Клик по ручке — меню
 * перестановки и вложенности (ADR 0034, DA3–DA4).
 */
import { useSelector } from '@tanstack/react-store'

import type { CellComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import type { FailedAttempt } from '../../core/failedAttempts'
import { rejectionText } from '../../core/thenable'
import { DragHandler } from '../../grid/dnd'
import {
  type RowMoveDirection,
  canMoveRow,
  canNestRow,
  canUnnestRow,
  isMovableRow,
  moveRow,
  nestRow,
  unnestRow,
} from './moveRow'

type MoveAtoms = {
  atoms: { rowDragging: unknown; rowMoves: unknown; rowMoveFailed: unknown }
}

export const RowDraggingComponent = ({ row, table }: CellComponentProps) => {
  const { atoms } = table as unknown as MoveAtoms
  useSelector(atoms.rowDragging as never)
  // Ожидание и отказ переноса (ADR 0112) — только этой строки.
  const busy = useSelector(
    atoms.rowMoves as never,
    (moves: Record<string, { pending: boolean }>) => !!moves[row.id]?.pending,
  )
  const failed = useSelector(
    atoms.rowMoveFailed as never,
    (fails: Record<string, FailedAttempt>) => fails[row.id],
  )
  const labels = useLocalization()

  if (!row.getCanDrag()) {
    return null
  }

  const move = (id: string, label: string, direction: RowMoveDirection) => ({
    id,
    label,
    disabled: !canMoveRow(row, table, direction),
    onSelect: () => moveRow(row, table, direction),
  })

  const getMenuItems = () => [
    move('moveUp', labels.moveUp, -1),
    move('moveDown', labels.moveDown, 1),
    ...((table.options as { enableExpanding?: boolean }).enableExpanding ===
    true
      ? [
          {
            id: 'indent',
            label: labels.indentRow,
            disabled: !canNestRow(row, table),
            onSelect: () => nestRow(row, table),
          },
          {
            id: 'outdent',
            label: labels.outdentRow,
            disabled: !canUnnestRow(row),
            onSelect: () => unnestRow(row, table),
          },
        ]
      : []),
  ]

  return (
    <DragHandler
      id={row.id}
      type="row"
      label={labels.moveRow}
      table={table}
      busy={busy}
      failure={
        failed &&
        labels.actionFailedRetry(
          rejectionText(failed.error) ?? labels.moveRowFailed,
        )
      }
      getMenuItems={isMovableRow(row, table) ? getMenuItems : undefined}
    />
  )
}
