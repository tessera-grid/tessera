/**
 * Публичный канал состояния ядра (ADR 0120, §4): `state` и `handlers` `useCreateTable`
 * несут только срезы колонок — без них нет раскладки. Срез плагина задаётся аргументами
 * его фабрики; переданный ядру в обход типов он вырезается с dev-предупреждением (MP7).
 */
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  OnChangeFn,
} from '@tanstack/react-table'

/** Column slices the application passes to the core. */
export interface CoreTableState {
  columnVisibility?: ColumnVisibilityState
  columnOrder?: ColumnOrderState
  columnPinning?: ColumnPinningState
  columnSizing?: ColumnSizingState
}

/** Callbacks for column slices. */
export interface CoreTableHandlers {
  onColumnVisibilityChange?: OnChangeFn<ColumnVisibilityState>
  onColumnOrderChange?: OnChangeFn<ColumnOrderState>
  onColumnPinningChange?: OnChangeFn<ColumnPinningState>
  onColumnSizingChange?: OnChangeFn<ColumnSizingState>
}

const CORE_SLICES: readonly string[] = [
  'columnVisibility',
  'columnOrder',
  'columnPinning',
  'columnSizing',
]

/** Плагины, чьи аргументы принимают срез. */
const SLICE_OWNERS: Record<string, string> = {
  sorting: 'columnSortingModel или columnSorting',
  pagination: 'paginationModel или pagination',
  columnFilters: 'columnFilteringModel или columnFiltering',
  globalFilter: 'quickSearchModel или quickSearch',
  grouping: 'rowGroupingModel или rowGrouping',
  expanded: 'rowExpandingModel или rowExpanding',
  rowSelection: 'rowSelectionModel или rowSelection',
  cellSelection: 'cellSelectionModel или cellSelection',
}

/** Колбэки плагинов без среза. */
const CALLBACK_OWNERS: Record<string, string> = {
  onRowOrderChange: 'rowDragging',
}

const sliceOfHandler = (name: string): string | undefined => {
  const match = /^on([A-Z]\w*)Change$/.exec(name)
  return match
    ? match[1]!.charAt(0).toLowerCase() + match[1]!.slice(1)
    : undefined
}

/** Срезы колонок и всё остальное, что приложение передало ядру. */
export const splitCoreState = (
  state: Record<string, unknown> | undefined,
  handlers: Record<string, unknown> | undefined,
) => {
  const coreState: Record<string, unknown> = {}
  const coreHandlers: Record<string, unknown> = {}
  const foreign: string[] = []
  for (const [key, value] of Object.entries(state ?? {})) {
    if (CORE_SLICES.includes(key)) coreState[key] = value
    else if (value !== undefined) foreign.push(`state.${key}`)
  }
  for (const [name, value] of Object.entries(handlers ?? {})) {
    if (CORE_SLICES.includes(sliceOfHandler(name) ?? '')) {
      coreHandlers[name] = value
    } else if (value !== undefined) foreign.push(`handlers.${name}`)
  }
  return { coreState, coreHandlers, foreign }
}

/** Куда перенести срез или колбэк, переданный ядру. */
export const foreignSliceMessage = (path: string): string => {
  const [channel, name] = path.split('.') as [string, string]
  const slice = channel === 'state' ? name : sliceOfHandler(name)
  const owner = slice ? SLICE_OWNERS[slice] : undefined
  if (owner) {
    const cap = slice!.charAt(0).toUpperCase() + slice!.slice(1)
    return `${path} не применяется: срез плагина задаётся аргументами фабрики — ${slice}, on${cap}Change, initial${cap} у ${owner} (ADR 0120)`
  }
  const callbackOwner = CALLBACK_OWNERS[name]
  if (callbackOwner) {
    return `${path} не применяется: это аргумент плагина — ${callbackOwner}({ ${name} }) (ADR 0120)`
  }
  return `${path} не применяется: ядро принимает только срезы колонок (columnVisibility, columnOrder, columnPinning, columnSizing) и их колбэки (ADR 0120)`
}
