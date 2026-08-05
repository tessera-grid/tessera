import { TablePlugin } from '../types'
import { ColumnSizingComponent } from './ColumnSizingComponent'

export const columnSizingPlugin: TablePlugin = {
  createTable: table => {
    table.setRenderSlot({
      id: 'columnSizingPlugin',
      slot: 'rightHeaderSlot',
      order: 'last',
      component: ColumnSizingComponent,
    })
  },
}
