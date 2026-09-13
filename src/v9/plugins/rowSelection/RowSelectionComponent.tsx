/**
 * Фаза E — чекбокс выбора строки (v9-порт RowSelectionComponent).
 * Реактивность на `useSelector(table.atoms.rowSelection)`; группировка — хелпер.
 */
import { useSelector } from '@tanstack/react-store'

import type { CellComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../../lib/core/localization'
import { SelectCheckbox } from '../../../lib/plugins/rowSelection/SelectCheckbox'
import { isGroupingActive } from './selectionHelpers'
import type { RowSelectionPlugin } from './types'

export const RowSelectionComponent = ({ row, table }: CellComponentProps) => {
  const labels = useLocalization()

  useSelector((table as unknown as { atoms: { rowSelection: unknown } }).atoms.rowSelection as never)

  // Активная группировка делает выбор недоступным (ADR 0022): прячем чекбокс.
  if (isGroupingActive(table)) {
    return null
  }

  if (row.depth > 0 && !row.getCanSelectSubRows()) {
    return null
  }

  const { isAllRowsSelected, onSelectRow } = (
    table.getHooks() as RowSelectionPlugin
  ).rowSelection

  const canSelect = row.getCanSelect()
  const selected = row.getIsSelected()
  const indeterminate = row.getIsSomeSelected()

  const handleSelectRow = (event: unknown) => {
    row.getToggleSelectedHandler()(event)
    onSelectRow(row, !row.getIsSelected())
  }

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
