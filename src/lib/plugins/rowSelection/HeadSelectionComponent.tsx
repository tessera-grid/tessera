/**
 * «Выбрать все» в шапке колонки выбора. Реактивность
 * `useSelector(table.atoms.rowSelection)`; группировка/«можно выбрать» — через
 * хелперы. Индетерминантность = some && !all: getIsSomePageRowsSelected возвращает
 * true и когда выбраны ВСЕ, поэтому исключаем all явно.
 */
import { useSelector } from '@tanstack/react-store'

import type { HeaderComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { SelectCheckbox } from '../../plugins/rowSelection/SelectCheckbox'
import { getCanSomeRowsSelect, isGroupingActive } from './selectionHelpers'
import type { RowSelectionPlugin } from './types'

export const HeadSelectionComponent = ({ table }: HeaderComponentProps) => {
  const labels = useLocalization()

  useSelector(
    (table as unknown as { atoms: { rowSelection: unknown } }).atoms
      .rowSelection as never,
  )

  // Активная группировка делает выбор недоступным (ADR 0022): прячем «выбрать все».
  if (isGroupingActive(table)) {
    return null
  }

  const { isAllRowsSelected, onSelectAllRowsOnPage } = (
    table.getHooks() as RowSelectionPlugin
  ).rowSelection

  const selected = table.getIsAllPageRowsSelected()
  const indeterminate =
    table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
  const disabled = isAllRowsSelected || !getCanSomeRowsSelect(table)

  const handleSelectAllPageRows = (event: unknown) => {
    table.getToggleAllPageRowsSelectedHandler()(event)
    onSelectAllRowsOnPage(!table.getIsAllPageRowsSelected())
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
