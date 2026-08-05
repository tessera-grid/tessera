import { createColumnHelper } from '@tanstack/react-table'

import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

const columnHelper = createColumnHelper<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
>()

export const SWITCH_ACTION_COLUMN_ID = 'switchActionColumn'

export const switchActionColumn = columnHelper.accessor('id', {
  id: SWITCH_ACTION_COLUMN_ID,
  minSize: 150,
  size: 150,
  header: 'Checked',
  enablePinning: false,
  enableSorting: false,
  enableResizing: false,
  enableDragging: false,
})
