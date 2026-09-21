/**
 * Сервисная колонка выбора. `header`/`cell` — обёртки, инъектирующие слайс хуков
 * плагина в компонент типизированным пропсом (нативный FlexRender рендерит обёртку).
 */
import { createElement } from 'react'

import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'
import type {
  CellComponentProps,
  HeaderComponentProps,
} from '../../core/createSlots'
import { readPluginHooks } from '../../core/definePlugin'
import type { ColumnDef } from '../../types'
import { HeadSelectionComponent } from './HeadSelectionComponent'
import { RowSelectionComponent } from './RowSelectionComponent'
import type { RowSelectionHooks } from './types'

export const COLUMN_SELECTION_ID = getActionColumnId('rowSelection')

const readHooks = (table: { getHooks: () => unknown }) =>
  readPluginHooks<RowSelectionHooks>(table, 'rowSelection')

const leafColumn = {
  id: COLUMN_SELECTION_ID,
  accessorKey: COLUMN_SELECTION_ID,
  minSize: COLUMN_ACTIONS_SIZE,
  size: COLUMN_ACTIONS_SIZE,
  enableSorting: false,
  enableResizing: false,
  header: (ctx: HeaderComponentProps) =>
    createElement(HeadSelectionComponent, {
      ...ctx,
      hooks: readHooks(ctx.table),
    }),
  cell: (ctx: CellComponentProps) =>
    createElement(RowSelectionComponent, {
      ...ctx,
      hooks: readHooks(ctx.table),
    }),
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
        header: '',
        rowSpan: index === 0 ? depth - 1 : 0,
        columns: [currentChild],
      }) as unknown as ColumnDef<any, any, any>,
    leafColumn,
  )
}
