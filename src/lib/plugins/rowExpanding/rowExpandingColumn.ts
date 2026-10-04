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
}: ServiceColumnParts): ColumnDef<any, any, any> =>
  ({
    id: COLUMN_EXPANDING_ID,
    serviceLabel: 'expandColumn',
    accessorKey: 'id',
    minSize: COLUMN_ACTIONS_SIZE,
    size: COLUMN_ACTIONS_SIZE,
    header: undefined,
    enableSorting: false,
    enableResizing: false,
    cell,
  }) as unknown as ColumnDef<any, any, any>
