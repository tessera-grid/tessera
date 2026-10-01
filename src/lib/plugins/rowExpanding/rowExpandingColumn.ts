/**
 * Сервисная колонка раскрытия. `cell` — компонент с хуками плагина от `definePlugin`.
 * Под вложенной шапкой (depth>1) строит группы с rowSpan.
 */
import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'
import type { ServiceColumnParts } from '../../core/definePlugin'
import type { ColumnDef } from '../../types'

export const COLUMN_EXPANDING_ID = getActionColumnId('rowExpanding')

const leafColumnOf = ({ cell }: ServiceColumnParts) =>
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

export const getRowExpandingColumn = (
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
        id: `${COLUMN_EXPANDING_ID}-group-level-${index}`,
        serviceLabel: 'expandColumn',
        header: '',
        rowSpan: index === 0 ? depth - 1 : 0,
        columns: [currentChild],
      }) as unknown as ColumnDef<any, any, any>,
    leafColumn,
  )
}
