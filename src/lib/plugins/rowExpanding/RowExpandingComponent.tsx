/**
 * Ячейка колонки раскрытия. Реактивность на `useSelector(table.atoms.expanded)`.
 */
import { useSelector } from '@tanstack/react-store'

import type { CellComponentProps } from '../../core/createSlots'
import { ExpandButton } from '../../plugins/rowExpanding/ExpandButton'
import type { RowExpandingPlugin } from './types'

export const RowExpandingComponent = ({ row, table }: CellComponentProps) => {
  // Подписка на срез раскрытия.
  useSelector(
    (table as unknown as { atoms: { expanded: unknown } }).atoms
      .expanded as never,
  )

  if (!row.getCanExpand()) {
    return null
  }

  const { onExpandRow } = (table.getHooks() as RowExpandingPlugin).rowExpanding

  const onExpand = () => {
    row.getToggleExpandedHandler()()
    onExpandRow(row, !row.getIsExpanded())
  }

  return <ExpandButton expanded={row.getIsExpanded()} onClick={onExpand} />
}
