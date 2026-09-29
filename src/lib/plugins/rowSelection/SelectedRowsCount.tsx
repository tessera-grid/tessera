/**
 * Счётчик выбранных строк в нижней панели (ADR 0038, RS19–RS22). Не live-область:
 * выбор уже объявляется самим плагином (`announceSelection`).
 */
import type { RowSelectionState } from '@tanstack/react-table'

import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'

/** Выбранные `id` среза, а не строки модели: выбор на других страницах тоже считается. */
export const countSelectedRows = (selection: RowSelectionState | undefined) =>
  Object.values(selection ?? {}).filter(Boolean).length

export const SelectedRowsCount = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  const count = useTableState(table, state =>
    countSelectedRows(state.rowSelection as RowSelectionState | undefined),
  )

  return (
    <span data-testid="selected-rows-count">
      {count > 0 ? labels.selectedRows(count) : ''}
    </span>
  )
}
