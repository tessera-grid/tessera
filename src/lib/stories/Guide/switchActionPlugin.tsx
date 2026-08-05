import { TablePlugin } from '../../plugins/types'
import { SwitchActionComponent } from './SwitchActionComponent'
import { SWITCH_ACTION_COLUMN_ID } from './switchActionColumn'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const switchActionPlugin: TablePlugin<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
> = {
  createCell: (_staticCell, _staticColumn) => {
    if (_staticColumn.id !== SWITCH_ACTION_COLUMN_ID) return

    _staticCell.renderComponent = SwitchActionComponent
  },
}
