/**
 * «Выбрать все» в шапке колонки выбора. Реактивность на срезе `rowSelection`
 * (`useSlice`); бизнес-колбэки — из пропса `hooks`; группировка/«можно выбрать» —
 * хелперы. Индетерминантность = some && !all: getIsSomePageRowsSelected возвращает
 * true и когда выбраны ВСЕ, поэтому исключаем all явно.
 */
import type { PluginHeaderProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSlice } from '../../core/reactivity'
import { SelectCheckbox } from '../../ui/SelectCheckbox/SelectCheckbox'
import {
  getCanSomeRowsSelect,
  isGroupingActive,
} from '../rowSelectionModel/selectionHelpers'
import type { RowSelectionHooks } from './types'

export const HeadSelectionComponent = ({
  table,
  hooks,
}: PluginHeaderProps<Partial<RowSelectionHooks>>) => {
  const labels = useLocalization()

  useSlice(table, 'rowSelection')

  // Активная группировка делает выбор недоступным: прячем «выбрать все».
  if (isGroupingActive(table)) {
    return null
  }

  const { isAllRowsSelected = false, onSelectAllRowsOnPage } = hooks

  const selected = table.getIsAllPageRowsSelected()
  const indeterminate =
    table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
  const disabled = isAllRowsSelected || !getCanSomeRowsSelect(table)

  const handleSelectAllPageRows = (event: unknown) => {
    table.getToggleAllPageRowsSelectedHandler()(event)
    onSelectAllRowsOnPage?.(!table.getIsAllPageRowsSelected())
  }

  return (
    <SelectCheckbox
      selected={selected}
      indeterminate={indeterminate}
      onClick={handleSelectAllPageRows}
      disabled={disabled}
      label={labels.selectAll}
    />
  )
}
