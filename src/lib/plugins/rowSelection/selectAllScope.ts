/**
 * Строки охвата «Выбрать всё» в клиентском режиме (ADR 0179, §1–§2): выбираемые строки
 * после фильтров на всех страницах, текущей страницы или все строки данных. Вложенные —
 * только с `subRows` (ADR 0162); заглушки ленивых детей не выбираются (`getCanSelect`).
 */
import type { RowSelectionState } from '@tanstack/react-table'

import type { Row } from '../../types'
import {
  isClientGroupRow,
  isGroupingActive,
  subRowsOf,
} from '../rowSelectionModel/selectionHelpers'
import type { SelectAllScope } from './types'
import { rowsOf } from '../../core/rowEngine/rows'

interface ScopeTable {
  options: { rowSelectionSelectAll?: SelectAllScope }
  getCoreRowModel: () => { flatRows: Row<any, any>[] }
  getFilteredRowModel: () => { flatRows: Row<any, any>[] }
  getRowModel: () => { rows: Row<any, any>[] }
  setRowSelection: (
    updater: (old: RowSelectionState) => RowSelectionState,
  ) => void
}

export const selectAllScopeOf = (table: unknown): SelectAllScope =>
  (table as ScopeTable).options.rowSelectionSelectAll ?? 'filtered'

/** Строки страницы: её корни и все их потомки после фильтров, и свёрнутые. */
const pageRows = (t: ScopeTable) => {
  const rows: Row<any, any>[] = []
  const walk = (row: Row<any, any>) => {
    rows.push(row)
    row.subRows.forEach(walk)
  }
  for (const row of rowsOf<Row<any, any>>(t, 'shown').rows) {
    if (row.depth === 0) walk(row)
  }
  return rows
}

/** Строка в охвате: выбираемая строка данных нужного уровня. */
const inScopeOf = (table: unknown) => {
  // При группировке строки данных вложены в группы, а строки выбора — только они (ADR 0185, §5).
  const nested = !!subRowsOf(table) || isGroupingActive(table)
  return (row: Row<any, any>) =>
    (nested || row.depth === 0) && !isClientGroupRow(row) && row.getCanSelect()
}

export const scopeRowsOf = (
  table: unknown,
  scope: SelectAllScope,
): Row<any, any>[] => {
  const t = table as ScopeTable
  const rows =
    scope === 'all'
      ? [...rowsOf<Row<any, any>>(t, 'core').flatRows]
      : scope === 'filtered'
        ? [...rowsOf<Row<any, any>>(t, 'filtered').flatRows]
        : pageRows(t)
  return rows.filter(inScopeOf(table))
}

/**
 * Состояние флажка шапки без списка строк охвата (ADR 0179, SE17): выбранные — по ключам выбора,
 * «все» — до первой невыбранной строки охвата. Страница короткая — по её строкам.
 */
export const scopeStateOf = (
  table: unknown,
  scope: SelectAllScope,
  selection: RowSelectionState,
) => {
  if (scope === 'currentPage') {
    const rows = scopeRowsOf(table, scope)
    const { all, some } = scopeSelectionOf(rows, selection)
    return { all, some, empty: rows.length === 0 }
  }
  const view = rowsOf<Row<any, any>>(
    table as ScopeTable,
    scope === 'all' ? 'core' : 'filtered',
  )
  const inScope = inScopeOf(table)
  let some = false
  for (const id in selection) {
    const row = selection[id] ? view.byId(id) : undefined
    if (row && inScope(row)) {
      some = true
      break
    }
  }
  let empty = true
  let all = some
  for (const row of view.flatRows) {
    if (!inScope(row)) continue
    empty = false
    if (!selection[row.id]) {
      all = false
      break
    }
  }
  return { all: all && !empty, some, empty }
}

/** Выбраны ли все строки охвата и хотя бы одна. */
export const scopeSelectionOf = (
  rows: readonly Row<any, any>[],
  selection: RowSelectionState,
) => {
  let selected = 0
  for (const row of rows) if (selection[row.id]) selected++
  return {
    count: selected,
    all: rows.length > 0 && selected === rows.length,
    some: selected > 0,
  }
}

/** Выбрать строки охвата или снять с них выбор; выбор вне охвата не меняется. */
export const setScopeSelected = (
  table: unknown,
  rows: readonly Row<any, any>[],
  selected: boolean,
) =>
  (table as ScopeTable).setRowSelection(old => {
    // Снять весь выбор — без копии среза: на сотнях тысяч строк копия дороже всего нажатия.
    if (
      !selected &&
      scopeSelectionOf(rows, old).count === Object.keys(old).length
    )
      return {}
    const next = { ...old }
    for (const row of rows) {
      if (selected) next[row.id] = true
      else delete next[row.id]
    }
    return next
  })
