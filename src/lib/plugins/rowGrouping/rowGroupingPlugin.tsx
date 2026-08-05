import { TablePlugin } from '../types'
import { RowGroupingComponent } from './RowGroupingComponent'

export const rowGroupingPlugin: TablePlugin = {
  createTable: table => {
    table.setRenderSlot({
      id: 'rowGroupingPlugin',
      slot: 'rightHeaderSlot',
      order: 1,
      component: RowGroupingComponent,
    })
  },
}
