/**
 * Чекбокс выбора строки. Подписка — на свой вид: выбор другой строки его не
 * перерисовывает (ADR 0099, PF5). Бизнес-колбэки — из пропса `hooks` (инъекция
 * definePlugin); группировка — хелпер. У строки-группы серверной группировки флажок
 * выбирает группу целиком и бывает частичным (ADR 0148).
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { SelectCheckbox } from '../../ui/SelectCheckbox/SelectCheckbox'
import { groupSelectionOfRow, toggleRowSelection } from './keyboardActions'
import {
  groupKeysOfRow,
  isGroupingActive,
  isSelectableInList,
  isServerGroupRow,
} from '../rowSelectionModel/selectionHelpers'
import type { RowSelectionHooks } from './types'

export const RowSelectionComponent = ({
  row,
  table,
  hooks,
}: PluginCellProps<Partial<RowSelectionHooks>>) => {
  const labels = useLocalization()
  const group = isServerGroupRow(row)

  const { grouped, canSelect, selected, indeterminate } = useTableState(
    table,
    () => {
      const groupState = group ? groupSelectionOfRow(row) : undefined
      return {
        grouped: isGroupingActive(table),
        canSelect: row.getCanSelect(),
        selected: groupState ? groupState === 'all' : row.getIsSelected(),
        indeterminate: groupState
          ? groupState === 'some'
          : row.getIsSomeSelected(),
      }
    },
  )

  // Активная группировка делает выбор недоступным: прячем чекбокс.
  if (grouped) {
    return null
  }

  if (!isSelectableInList(row)) {
    return null
  }

  const { isAllRowsSelected = false } = hooks

  const handleSelectRow = (event: unknown) => {
    reportAction(table, {
      plugin: 'rowSelection',
      ...(group
        ? {
            action: 'toggleGroup',
            detail: { keys: groupKeysOfRow(row), selected: !selected },
          }
        : {
            action: 'toggleRow',
            detail: { rowId: row.id, selected: !row.getIsSelected() },
          }),
      source: sourceOf(event),
    })
    toggleRowSelection(row, hooks, event)
  }

  return (
    <SelectCheckbox
      selected={selected}
      indeterminate={indeterminate}
      onClick={handleSelectRow}
      disabled={!canSelect || isAllRowsSelected}
      label={group ? labels.selectGroup : labels.selectRow}
    />
  )
}
