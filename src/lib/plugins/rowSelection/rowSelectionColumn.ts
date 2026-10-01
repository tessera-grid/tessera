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

const leafColumnOf = ({ cell, header }: ServiceColumnParts) =>
  ({
    id: COLUMN_SELECTION_ID,
    accessorKey: COLUMN_SELECTION_ID,
    minSize: COLUMN_ACTIONS_SIZE,
    size: COLUMN_ACTIONS_SIZE,
    enableSorting: false,
    enableResizing: false,
    header,
    cell,
  }) as unknown as ColumnDef<any, any, any>

export const getRowSelectionColumn = (
  depth: number,
  parts: ServiceColumnParts,
): ColumnDef<any, any, any> => {
  const leafColumn = leafColumnOf(parts)
  if (depth <= 1) {
    return leafColumn
  }

  return Array.from({ length: depth - 1 }).reduceRight<
    ColumnDef<any, any, any>
  >(
    (currentChild, _, index) =>
      ({
        id: `${COLUMN_SELECTION_ID}-group-level-${index}`,
        header: '',
        rowSpan: index === 0 ? depth - 1 : 0,
        columns: [currentChild],
      }) as unknown as ColumnDef<any, any, any>,
    leafColumn,
  )
}
