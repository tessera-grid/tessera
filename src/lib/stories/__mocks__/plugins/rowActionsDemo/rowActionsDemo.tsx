import { Copy, Pencil, Trash2 } from 'lucide-react'

import { RowAction } from '../../../../../lib/core/headerActions'

// Демо-набор действий строки как единые дескрипторы (`RowAction`). Инлайн — ряд
// row-кнопок (ревил по hover строки); при подключённом `rowActionMenu` схлопываются
// в overflow-кебаб. Обработчики демонстрационные (no-op) — показываем механику
// подачи, а не мутацию данных.
export const rowActionsDemo: RowAction[] = [
  {
    id: 'edit',
    slot: 'actionRowSlot',
    order: 0,
    icon: () => <Pencil width={16} height={16} />,
    label: () => 'Edit',
    onSelect: () => {},
  },
  {
    id: 'duplicate',
    slot: 'actionRowSlot',
    order: 1,
    icon: () => <Copy width={16} height={16} />,
    label: () => 'Duplicate',
    onSelect: () => {},
  },
  {
    id: 'delete',
    slot: 'actionRowSlot',
    order: 2,
    icon: () => <Trash2 width={16} height={16} />,
    label: () => 'Delete',
    tone: 'danger',
    onSelect: () => {},
  },
]
