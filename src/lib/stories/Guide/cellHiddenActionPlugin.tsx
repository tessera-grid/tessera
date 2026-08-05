import { TablePlugin } from '../../plugins/types'
import { CellHiddenComponent } from './CellHiddenComponent'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const cellHiddenActionPlugin: TablePlugin<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
> = {
  createTable: table => {
    table.setRenderSlot({
      id: 'cellHiddenActionPlugin',
      slot: 'rightCellSlot',
      order: 0,
      component: CellHiddenComponent,
    })
  },
}
