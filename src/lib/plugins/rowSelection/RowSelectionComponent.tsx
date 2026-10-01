/**
 * Чекбокс выбора строки. Реактивность на срезе `rowSelection` (`useSlice`);
 * бизнес-колбэки — из пропса `hooks` (инъекция definePlugin); группировка — хелпер.
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSlice } from '../../core/reactivity'
import { SelectCheckbox } from '../../ui/SelectCheckbox/SelectCheckbox'
import { toggleRowSelection } from './keyboardActions'
import { isGroupingActive } from './selectionHelpers'
import type { RowSelectionHooks } from './types'

export const RowSelectionComponent = ({
  row,
  table,
  hooks,
}: PluginCellProps<Partial<RowSelectionHooks>>) => {
  const labels = useLocalization()

  useSlice(table, 'rowSelection')

  // Активная группировка делает выбор недоступным: прячем чекбокс.
  if (isGroupingActive(table)) {
    return null
  }

  if (row.depth > 0 && !row.getCanSelectSubRows()) {
    return null
  }

  const { isAllRowsSelected = false } = hooks

  const canSelect = row.getCanSelect()
  const selected = row.getIsSelected()
  const indeterminate = row.getIsSomeSelected()

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
