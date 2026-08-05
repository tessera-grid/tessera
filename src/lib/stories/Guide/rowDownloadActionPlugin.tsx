import { TablePlugin } from '../../plugins/types'
import { RowDownloadComponent } from './RowDownloadComponent'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const rowDownloadActionPlugin: TablePlugin<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
> = {
  createTable: table => {
    table.setRenderSlot({
      id: 'rowDownloadActionPlugin',
      order: 0,
      slot: 'actionRowSlot',
      component: RowDownloadComponent,
    })
  },
}
