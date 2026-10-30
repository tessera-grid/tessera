/**
 * Сервисная колонка раскрытия. `cell` — компонент с хуками плагина от `definePlugin`.
 */
import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'
import type { ServiceColumnParts } from '../../core/definePlugin'
import type { ColumnDef } from '../../types'

export const COLUMN_EXPANDING_ID = getActionColumnId('rowExpanding')

export const getRowExpandingColumn = ({
  cell,
  header,
}: ServiceColumnParts): ColumnDef<any, any, any> =>
  ({
    id: COLUMN_EXPANDING_ID,
    serviceLabel: 'expandColumn',
    skeletonCell: 'control',
    controlSized: true,
    accessorKey: 'id',
    minSize: 0,
    size: COLUMN_ACTIONS_SIZE,
    header,
    enableSorting: false,
    enableResizing: false,
    cell,
  }) as unknown as ColumnDef<any, any, any>
