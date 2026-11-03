/**
 * «Выбрать все» в шапке колонки выбора: строки охвата `selectAll` (ADR 0179). Реактивность на
 * срезе `rowSelection` (`useSlice`); бизнес-колбэки — из пропса `hooks`.
 */
import type { RowSelectionState } from '@tanstack/react-table'

import { reportAction, sourceOf } from '../../core/debugActions'
import type { PluginHeaderProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import { useSlice, useTableState } from '../../core/reactivity'
import {
  isWholeSelection,
  rowSelectionValueOf,
  setAllRowsSelected,
  tableAllSelection,
} from '../../core/rowSelectionAll'
import { SelectCheckbox } from '../../ui/SelectCheckbox/SelectCheckbox'
import { isGroupingActive } from '../rowSelectionModel/selectionHelpers'
import {
  scopeRowsOf,
  scopeSelectionOf,
  selectAllScopeOf,
  setScopeSelected,
} from './selectAllScope'
import type { RowSelectionHooks } from './types'

export const HeadSelectionComponent = ({
  table,
  hooks,
}: PluginHeaderProps<Partial<RowSelectionHooks>>) => {
  const labels = useLocalization()

  const selection = (useSlice(table, 'rowSelection') ?? {}) as RowSelectionState
  // Строки охвата меняются с фильтрами, поиском, страницей и порядком строк.
  useTableState(table, state => {
    const { columnFilters, globalFilter, pagination, sorting } =
      state as unknown as Record<string, unknown>
    return [columnFilters, globalFilter, pagination, sorting]
  })

  // Активная группировка делает выбор недоступным: прячем «выбрать все».
  if (isGroupingActive(table)) {
    return null
  }

  const { isAllRowsSelected = false, onSelectAllRows } = hooks

  // Серверная модель строк: «Выбрать всё» — весь итог без загрузки, снятые флажки —
  // исключения (ADR 0138, §9); узлы групп и веток оно сбрасывает (ADR 0148, §2; ADR 0162).
  if (serverRowModelReason(table)) {
    const all = tableAllSelection(table)
    const allSelected = isWholeSelection(all)
    const handleSelectAll = (event: unknown) => {
      reportAction(table, {
        plugin: 'rowSelection',
        action: 'toggleAllRows',
        detail: { selected: !allSelected },
        source: sourceOf(event),
      })
      setAllRowsSelected(table, !allSelected)
      onSelectAllRows?.(!allSelected, 'all')
    }
    return (
      <SelectCheckbox
        selected={allSelected}
        indeterminate={
          all
            ? !allSelected
            : Object.values(rowSelectionValueOf(table)).some(Boolean)
        }
        onClick={handleSelectAll}
        disabled={isAllRowsSelected}
        label={labels.selectAll}
      />
    )
  }

  const scope = selectAllScopeOf(table)
  const rows = scopeRowsOf(table, scope)
  const { all, some } = scopeSelectionOf(rows, selection)
  const selected = all
  const indeterminate = some && !all
  const disabled = isAllRowsSelected || rows.length === 0

  const handleSelectAll = (event: unknown) => {
    reportAction(table, {
      plugin: 'rowSelection',
      action: scope === 'currentPage' ? 'toggleAllPageRows' : 'toggleAllRows',
      detail: { selected: !all, scope },
      source: sourceOf(event),
    })
    setScopeSelected(table, scopeRowsOf(table, scope), !all)
    onSelectAllRows?.(!all, scope)
  }

  return (
    <SelectCheckbox
      selected={selected}
      indeterminate={indeterminate}
      onClick={handleSelectAll}
      disabled={disabled}
      label={labels.selectAll}
    />
  )
}
