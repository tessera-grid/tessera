/**
 * Фаза E — «выбрать все» в шапке колонки выбора (v9-порт HeadSelectionComponent).
 *
 * Отличия от v8:
 *  - реактивность `useSelector(table.atoms.rowSelection)` вместо useSubscribeStore;
 *  - группировка/«можно выбрать» — через хелперы (в v9 нет getState/getCanSomeRowsSelect);
 *  - индетерминантность = some && !all: в v9 getIsSomePageRowsSelected стал true и
 *    когда выбраны ВСЕ, поэтому исключаем all явно.
 */
import { useSelector } from '@tanstack/react-store'

import type { HeaderComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../../lib/core/localization'
import { SelectCheckbox } from '../../../lib/plugins/rowSelection/SelectCheckbox'
import { getCanSomeRowsSelect, isGroupingActive } from './selectionHelpers'
import type { RowSelectionPlugin } from './types'

export const HeadSelectionComponent = ({ table }: HeaderComponentProps) => {
  const labels = useLocalization()

  useSelector((table as unknown as { atoms: { rowSelection: unknown } }).atoms.rowSelection as never)

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
