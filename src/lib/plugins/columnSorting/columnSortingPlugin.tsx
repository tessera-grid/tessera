import { TablePlugin } from '../types'
import { ColumnSortingComponent } from './ColumnSortingComponent'

export const columnSortingPlugin: TablePlugin = {
  createTable: table => {
    table.setRenderSlot({
      id: 'columnSortingPlugin',
      slot: 'rightHeaderSlot',
      order: 1,
      component: ColumnSortingComponent,
    })
  },
}
