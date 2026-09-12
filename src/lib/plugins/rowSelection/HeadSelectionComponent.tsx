import { memo } from 'react'

import { HeaderContext } from '@tanstack/react-table'

import { useLocalization } from '../../core/localization'
import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { SelectCheckbox } from './SelectCheckbox'

export const HeadSelectionComponent = memo(({ table }: HeaderContext) => {
  const labels = useLocalization()

  useSubscribeStore(() => [
    table.getIsAllPageRowsSelected(),
    table.getIsSomePageRowsSelected(),
    table.getCanSomeRowsSelect(),
    (table.getState().grouping?.length ?? 0) > 0,
    // TODO: перенести в state таблицы
    table.getHooks().rowSelection.isAllRowsSelected,
  ])

  // Активная группировка делает выбор недоступным (ADR 0022): прячем «выбрать
  // все», как прячется чекбокс строки. Пока группировка лишь включена, но не
  // применена, «выбрать все» работает как обычно.
  if ((table.getState().grouping?.length ?? 0) > 0) {
    return null
  }

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
      label={labels.selectAll}
    />
  )
})
