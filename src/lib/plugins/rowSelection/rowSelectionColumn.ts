/**
 * Сервисная колонка выбора. `header`/`cell` — компоненты с хуками плагина от
 * `definePlugin` (нативный FlexRender рендерит обёртку).
 */
import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'
import type { ServiceColumnParts } from '../../core/definePlugin'
import type { ColumnDef } from '../../types'

export const COLUMN_SELECTION_ID = getActionColumnId('rowSelection')

export const getRowSelectionColumn = ({
  cell,
  header,
}: ServiceColumnParts): ColumnDef<any, any, any> =>
  ({
    id: COLUMN_SELECTION_ID,
    accessorKey: COLUMN_SELECTION_ID,
    skeletonCell: 'control',
    controlSized: true,
    minSize: 0,
    size: COLUMN_ACTIONS_SIZE,
    enableSorting: false,
    enableResizing: false,
    header,
    cell,
  }) as unknown as ColumnDef<any, any, any>
