import { TablePlugin } from '../../../../plugins/types'
import { RowDeleteActionComponent } from './RowDeleteActionComponent'

export const rowDeleteActionPlugin: TablePlugin = {
  createTable: table => {
    table.setRenderSlot({
      id: 'rowDeletePlugin',
      order: 'last',
      slot: 'actionRowSlot',
      component: RowDeleteActionComponent,
    })
  },
}
