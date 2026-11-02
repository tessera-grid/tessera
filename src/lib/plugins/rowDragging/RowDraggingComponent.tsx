/**
 * Ячейка-ручка перетаскивания строки. Реактивность на всегда-присутствующий срез
 * `rowDragging`. Переиспользуем grid-компонент DragHandler. Клик по ручке — меню
 * перестановки и вложенности (ADR 0034, DA3–DA4).
 */
import { useSelector } from '@tanstack/react-store'

import type { CellComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { hasRowHierarchy } from '../../core/rowHierarchy'
import { DragHandler } from '../../shared/dnd'
import {
  type RowMoveDirection,
  canMoveRow,
  canMoveRowToEdge,
  canNestRow,
  canUnnestRow,
  isMovableRow,
  moveRow,
  moveRowToEdge,
  nestRow,
  unnestRow,
} from './moveRow'
import { type RowMoveEdge, serverMoveSource } from './serverMove'

type MoveAtoms = {
  atoms: { rowDragging: unknown; rowMoves: unknown }
}

export const RowDraggingComponent = ({ row, table }: CellComponentProps) => {
  const { atoms } = table as unknown as MoveAtoms
  useSelector(atoms.rowDragging as never)
  // Ожидание переноса (ADR 0112) — только этой строки: меню ручки не открывается.
  const busy = useSelector(
    atoms.rowMoves as never,
    (moves: Record<string, { pending: boolean }>) => !!moves[row.id]?.pending,
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

  const edge = (id: string, label: string, to: RowMoveEdge) => ({
    id,
    label,
    disabled: !canMoveRowToEdge(row, table, to),
    onSelect: () => moveRowToEdge(row, table, to),
  })

  const server = !!serverMoveSource(table)
  const getMenuItems = () => [
    move('moveUp', labels.moveUp, -1),
    move('moveDown', labels.moveDown, 1),
    // В серверной модели — к краям ветки; вложение и вынос — только броском (ADR 0159, §6).
    ...(server
      ? [
          edge('moveToStart', labels.moveToStart, 'start'),
          edge('moveToEnd', labels.moveToEnd, 'end'),
        ]
      : []),
    ...(!server && hasRowHierarchy(table, 'tree')
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
            disabled: !canUnnestRow(row, table),
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
      getMenuItems={isMovableRow(row, table) ? getMenuItems : undefined}
    />
  )
}
