/**
 * Сервисная колонка выбора. `header`/`cell` — обёртки `injectHeaderHooks`/
 * `injectCellHooks`: подмешивают hook-слайс плагина в компонент типизированным
 * пропсом (нативный FlexRender рендерит обёртку).
 */
import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'
import { injectCellHooks, injectHeaderHooks } from '../../core/definePlugin'
import type { ColumnDef } from '../../types'
import { HeadSelectionComponent } from './HeadSelectionComponent'
import { RowSelectionComponent } from './RowSelectionComponent'

export const COLUMN_SELECTION_ID = getActionColumnId('rowSelection')

const leafColumn = {
  id: COLUMN_SELECTION_ID,
  serviceLabel: 'selectColumn',
  accessorKey: COLUMN_SELECTION_ID,
  minSize: COLUMN_ACTIONS_SIZE,
  size: COLUMN_ACTIONS_SIZE,
  enableSorting: false,
  enableResizing: false,
  header: injectHeaderHooks(HeadSelectionComponent, 'rowSelection'),
  cell: injectCellHooks(RowSelectionComponent, 'rowSelection'),
} as unknown as ColumnDef<any, any, any>

export const getRowSelectionColumn = (
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
        id: `${COLUMN_SELECTION_ID}-group-level-${index}`,
        serviceLabel: 'selectColumn',
        header: '',
        rowSpan: index === 0 ? depth - 1 : 0,
        columns: [currentChild],
      }) as unknown as ColumnDef<any, any, any>,
    leafColumn,
  )
}
