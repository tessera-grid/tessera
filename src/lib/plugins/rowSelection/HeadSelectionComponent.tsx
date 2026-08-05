import { memo } from 'react'

import { HeaderContext } from '@tanstack/react-table'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { SelectCheckbox } from './SelectCheckbox'

export const HeadSelectionComponent = memo(({ table }: HeaderContext) => {
  useSubscribeStore(() => [
    table.getIsAllPageRowsSelected(),
    table.getIsSomePageRowsSelected(),
    table.getCanSomeRowsSelect(),
    // TODO: перенести в state таблицы
    table.getHooks().rowSelection.isAllRowsSelected,
  ])

  // TODO: перенести в state таблицы
  const { isAllRowsSelected } = table.getHooks().rowSelection

  const selected = table.getIsAllPageRowsSelected()
  const indeterminate = table.getIsSomePageRowsSelected()
  const disabled = isAllRowsSelected || !table.getCanSomeRowsSelect()

  const handleSelectAllPageRows = (event: unknown) => {
    const { onSelectAllRowsOnPage } = table.getHooks().rowSelection

    const selectedHandler = table.getToggleAllPageRowsSelectedHandler()
    selectedHandler(event)
    onSelectAllRowsOnPage(!table.getIsAllPageRowsSelected())
  }

  return (
    <SelectCheckbox
      selected={selected}
      indeterminate={indeterminate}
      onClick={handleSelectAllPageRows}
      disabled={disabled}
    />
  )
})
