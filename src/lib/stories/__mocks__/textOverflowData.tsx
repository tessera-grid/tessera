// Длинные подписи для истории «Text overflow» (ADR 0083): заголовки, варианты
// фильтра, пункты меню строки и плейсхолдер поиска длиннее своих мест.
import type { ColumnDef } from '@tanstack/react-table'
import { Archive, Pencil } from 'lucide-react'

import type { TesseraFeatureEntry } from '../../../lib/core/features'
import type { RowAction } from '../../../lib/core/headerActions'

export const LONG_STATUS_OPTIONS = [
  {
    value: 'review',
    label: 'Awaiting review by the regional compliance department',
  },
  {
    value: 'approved',
    label: 'Approved after the second round of negotiations with procurement',
  },
  { value: 'won', label: 'Won' },
]

export interface TextOverflowItem {
  id: string
  account: string
  status: string
}

export const textOverflowData: TextOverflowItem[] = Array.from(
  { length: 200 },
  (_, i) => ({
    id: String(i),
    account: `Account ${i} of the northern distribution network`,
    status: LONG_STATUS_OPTIONS[i % LONG_STATUS_OPTIONS.length]!.value,
  }),
)

export const textOverflowColumns: ColumnDef<any, any>[] = [
  {
    id: 'account',
    accessorKey: 'account',
    header: 'Customer account responsible for the regional contract',
    size: 200,
    filter: 'text',
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Current approval status of the commercial proposal',
    size: 200,
    options: LONG_STATUS_OPTIONS,
    filter: 'select',
  },
]

const longRowActions: RowAction[] = [
  {
    id: 'reassign',
    slot: 'actionRowSlot',
    order: 0,
    icon: () => <Pencil width={16} height={16} />,
    label: () =>
      'Reassign the account to another manager in the same regional office',
    onSelect: () => {},
  },
  {
    id: 'archive',
    slot: 'actionRowSlot',
    order: 1,
    icon: () => <Archive width={16} height={16} />,
    label: () => 'Archive',
    onSelect: () => {},
  },
]

export const textOverflowPlugins: TesseraFeatureEntry[] = [
  { id: 'textOverflowActions', slotActions: longRowActions },
]

export const textOverflowLocalization = {
  search: 'Search accounts, managers, regions and contract numbers',
}
