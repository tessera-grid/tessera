/**
 * «Выбрать все» в шапке колонки выбора: строки охвата `selectAll` (ADR 0179); где строк нет у
 * грида — срез «всё, кроме» (§3–§4). Реактивность на срезе `rowSelection` (`useSlice`);
 * бизнес-колбэки — из пропса `hooks`.
 */
import type { RowSelectionState } from '@tanstack/react-table'

import { reportAction, sourceOf } from '../../core/debugActions'
import { pluginStateKey, type PluginHeaderProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { partialRowsReason } from '../../core/dataMode'
import { useKeyedSlice, useTableState } from '../../core/reactivity'
import {
  isWholeSelection,
  rowSelectionValueOf,
  setAllRowsSelected,
  tableAllSelection,
} from '../../core/rowSelectionAll'
import type { ServerActionStatus } from '../../core/serverActions'
import { Checkbox } from '../../ui/Checkbox/Checkbox'
import {
  scopeRowsOf,
  scopeSelectionOf,
  selectAllScopeOf,
  setScopeSelected,
} from './selectAllScope'
import {
  selectsServerPage,
  serverPageSelectionOf,
  toggleServerPage,
} from './serverPageSelection'
import type { RowSelectionHooks } from './types'
import { rowSelectionLabels } from './labels'

export const HeadSelectionComponent = ({
  table,
  hooks,
}: PluginHeaderProps<Partial<RowSelectionHooks>>) => {
  const labels = useLocalization()

  const selection =
    useKeyedSlice<RowSelectionState>(table, 'rowSelection') ?? {}
  // Строки охвата меняются с фильтрами, поиском, страницей и порядком строк.
  useTableState(table, state => {
    const { columnFilters, globalFilter, pagination, sorting } =
      state as unknown as Record<string, unknown>
    return [columnFilters, globalFilter, pagination, sorting]
  })

  const { onSelectAllRows } = hooks
  const partial = partialRowsReason(table)
  // Страница серверной модели: строки приходят по нажатию (ADR 0188).
  const serverPage = selectsServerPage(table)
  const pageWaits = useTableState(table, state => {
    const { serverAction } = state as unknown as {
      serverAction?: ServerActionStatus
    }
    return serverAction?.loadingRows?.kind === 'selectPage'
  })
  // Строки страницы приходят блоками: состояние флажка меняется с ними.
  useTableState(table, state =>
    serverPage
      ? (state as unknown as Record<string, unknown>)[
          pluginStateKey('serverRowModel')
        ]
      : undefined,
  )
  if (serverPage) {
    const { all, some, disabled } = serverPageSelectionOf(table)
    return (
      <Checkbox
        className="row-select-checkbox"
        checked={all}
        indeterminate={some && !all}
        pending={pageWaits}
        disabled={disabled}
        onCheckedChange={(_, event) =>
          toggleServerPage(table, hooks, sourceOf(event))
        }
        label={rowSelectionLabels(labels).selectAll}
      />
    )
  }
  // Серверная модель строк без пагинации — весь итог при любом охвате (ADR 0179, §4).
  const scope = partial === 'serverRowModel' ? 'all' : selectAllScopeOf(table)

  // Строк нет у грида: «Выбрать всё» — весь итог без загрузки, снятые флажки — исключения
  // (ADR 0138, §9; ADR 0179, §3); узлы групп и веток оно сбрасывает (ADR 0148, §2; ADR 0162).
  if (partial && scope !== 'currentPage') {
    const all = tableAllSelection(table)
    const allSelected = isWholeSelection(all)
    const handleSelectAll = (event: unknown) => {
      reportAction(table, {
        plugin: 'rowSelection',
        action: 'toggleAllRows',
        detail: { selected: !allSelected, scope },
        source: sourceOf(event),
      })
      setAllRowsSelected(table, !allSelected)
      onSelectAllRows?.(!allSelected, scope)
    }
    return (
      <Checkbox
        className="row-select-checkbox"
        checked={allSelected}
        indeterminate={
          all
            ? !allSelected
            : Object.values(rowSelectionValueOf(table)).some(Boolean)
        }
        onCheckedChange={(_, event) => handleSelectAll(event)}
        label={rowSelectionLabels(labels).selectAll}
      />
    )
  }

  const rows = scopeRowsOf(table, scope)
  const { all, some } = scopeSelectionOf(rows, selection)
  const selected = all
  const indeterminate = some && !all
  const disabled = rows.length === 0

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
    <Checkbox
      className="row-select-checkbox"
      checked={selected}
      indeterminate={indeterminate}
      onCheckedChange={(_, event) => handleSelectAll(event)}
      disabled={disabled}
      label={rowSelectionLabels(labels).selectAll}
    />
  )
}
