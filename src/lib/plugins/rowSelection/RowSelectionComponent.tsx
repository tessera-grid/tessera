/**
 * Чекбокс выбора строки. Подписка — на свой вид: выбор другой строки его не
 * перерисовывает (ADR 0099, PF5). Бизнес-колбэки — из пропса `hooks` (инъекция
 * definePlugin); группировка — хелпер.
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { SelectCheckbox } from '../../ui/SelectCheckbox/SelectCheckbox'
import { toggleRowSelection } from './keyboardActions'
import { isGroupingActive } from '../rowSelectionModel/selectionHelpers'
import type { RowSelectionHooks } from './types'

export const RowSelectionComponent = ({
  row,
  table,
  hooks,
}: PluginCellProps<Partial<RowSelectionHooks>>) => {
  const labels = useLocalization()

  const { grouped, canSelect, selected, indeterminate } = useTableState(
    table,
    () => ({
      grouped: isGroupingActive(table),
      canSelect: row.getCanSelect(),
      selected: row.getIsSelected(),
      indeterminate: row.getIsSomeSelected(),
    }),
  )

  // Активная группировка делает выбор недоступным: прячем чекбокс.
  if (grouped) {
    return null
  }

  if (row.depth > 0 && !row.getCanSelectSubRows()) {
    return null
  }

  const { isAllRowsSelected = false } = hooks

  const handleSelectRow = (event: unknown) =>
    toggleRowSelection(row, hooks, event)

  return (
    <SelectCheckbox
      selected={selected}
      indeterminate={indeterminate}
      onClick={handleSelectRow}
      disabled={!canSelect || isAllRowsSelected}
      label={labels.selectRow}
    />
  )
}
