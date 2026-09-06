import { memo } from 'react'

import { useLocalization } from '../../core/localization'
import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { CellComponentProps } from '../types'
import { SelectCheckbox } from './SelectCheckbox'

export const RowSelectionComponent = memo(
  ({ row, table }: CellComponentProps) => {
    const labels = useLocalization()

    useSubscribeStore(() => [
      row.getIsSelected(),
      row.getIsSomeSelected(),
      row.getCanSelect(),
      row.getCanSelectSubRows(),
      // TODO: перенести в state таблицы
      table.getHooks().rowSelection.isAllRowsSelected,
    ])

    if (row.depth > 0 && !row.getCanSelectSubRows()) {
      return null
    }

    const canSelect = row.getCanSelect()
    const selected = row.getIsSelected()
    const indeterminate = row.getIsSomeSelected()

    const handleSelectRow = (event: unknown) => {
      const { onSelectRow } = table.getHooks().rowSelection

      const selectedHandler = row.getToggleSelectedHandler()
      selectedHandler(event)
      onSelectRow(row, !row.getIsSelected())
    }

    // TODO: перенести в состояния
    const { isAllRowsSelected } = table.getHooks().rowSelection

    return (
      <SelectCheckbox
        selected={selected}
        indeterminate={indeterminate}
        onClick={handleSelectRow}
        disabled={!canSelect || isAllRowsSelected}
        label={labels.selectRow}
      />
    )
  },
)
