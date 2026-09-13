/**
 * Фаза E — ячейка колонки раскрытия (v9-порт RowExpandingComponent).
 *
 * Отличие от v8: реактивность на `useSelector(table.atoms.expanded)` вместо
 * `useSubscribeStore` (Pub-Sub). Тонкая настройка гранулярности подписки — фаза D;
 * живая проверка — на cutover (нужен DOM). Здесь важна корректность контракта.
 */
import { useSelector } from '@tanstack/react-store'

import type { CellComponentProps } from '../../core/createSlots'
import { ExpandButton } from '../../../lib/plugins/rowExpanding/ExpandButton'
import type { RowExpandingPlugin } from './types'

export const RowExpandingComponent = ({ row, table }: CellComponentProps) => {
  // Подписка на срез раскрытия (в v9 — атом, а не Pub-Sub).
  useSelector((table as unknown as { atoms: { expanded: unknown } }).atoms.expanded as never)

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
