/**
 * Сервисная колонка раскрытия. `cell` — компонент напрямую (нативный FlexRender).
 * Под вложенной шапкой (depth>1) строит группы с rowSpan.
 */
import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'
import { injectCellHooks } from '../../core/definePlugin'
import type { ColumnDef } from '../../types'
import { RowExpandingComponent } from './RowExpandingComponent'

export const COLUMN_EXPANDING_ID = getActionColumnId('rowExpanding')

const leafColumn = {
  id: COLUMN_EXPANDING_ID,
  accessorKey: 'id',
  minSize: COLUMN_ACTIONS_SIZE,
  size: COLUMN_ACTIONS_SIZE,
  header: undefined,
  enableSorting: false,
  enableResizing: false,
  cell: injectCellHooks(RowExpandingComponent, 'rowExpanding'),
} as unknown as ColumnDef<any, any, any>

export const getRowExpandingColumn = (
  depth: number,
): ColumnDef<any, any, any> => {
  if (depth <= 1) {
    return leafColumn
  }

  return Array.from({ length: depth - 1 }).reduceRight<
    ColumnDef<any, any, any>
  >(
    (currentChild, _, index) =>
      ({
        id: `${COLUMN_EXPANDING_ID}-group-level-${index}`,
        header: '',
        rowSpan: index === 0 ? depth - 1 : 0,
        columns: [currentChild],
      }) as unknown as ColumnDef<any, any, any>,
    leafColumn,
  )
}
