/**
 * «Выбрать все» в шапке колонки выбора. Реактивность на срезе `rowSelection`
 * (`useSlice`); бизнес-колбэки — из пропса `hooks`; группировка/«можно выбрать» —
 * хелперы. Индетерминантность = some && !all: getIsSomePageRowsSelected возвращает
 * true и когда выбраны ВСЕ, поэтому исключаем all явно.
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import type { PluginHeaderProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import { useSlice } from '../../core/reactivity'
import {
  isWholeSelection,
  rowSelectionValueOf,
  setAllRowsSelected,
  tableAllSelection,
} from '../../core/rowSelectionAll'
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
      onSelectAllRowsOnPage?.(!allSelected)
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

  const selected = table.getIsAllPageRowsSelected()
  const indeterminate =
    table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
  const disabled = isAllRowsSelected || !getCanSomeRowsSelect(table)

  const handleSelectAllPageRows = (event: unknown) => {
    reportAction(table, {
      plugin: 'rowSelection',
      action: 'toggleAllPageRows',
      detail: { selected: !table.getIsAllPageRowsSelected() },
      source: sourceOf(event),
    })
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
