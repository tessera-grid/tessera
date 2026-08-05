import { TablePlugin } from '../types'
import { ColumnPinningComponent } from './ColumnPinningComponent'

/**
 * Расширение для возможности закрепления столбцов
 * Предполагается, что пользователь может закреплять столбцы только к левому краю таблицы
 */
export const columnPinningPlugin: TablePlugin = {
  createColumn: (_staticColumn, table) => {
    const originalGetCanPin = _staticColumn.getCanPin

    _staticColumn.getCanPin = () => {
      if (table.getHeaderGroups().length !== 1) {
        return false
      }

      return originalGetCanPin()
    }
  },
  createTable: table => {
    table.setRenderSlot({
      id: 'columnPinningPlugin',
      slot: 'rightHeaderSlot',
      order: 0,
      component: ColumnPinningComponent,
    })
  },
}
