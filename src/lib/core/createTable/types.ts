import {
  AccessorKeyColumnDef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingColumnDef,
  ColumnSizingState,
  ColumnSort,
  ExpandedState,
  GroupingState,
  OnChangeFn,
  RowSelectionState,
  TableOptions,
  TableState,
  VisibilityState,
} from '@tanstack/react-table'

import { RegistryEntry } from '../pluginContract'
import { RowActionsOptions } from '../createColumns/createRowActionsColumn'
import { PluginsHooks } from '../createHooks'
import { SkeletonOptions } from '../skeletonOverlay/types'

export interface CreateDataGridHandlers<TData = any> {
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  onColumnPinningChange?: OnChangeFn<ColumnPinningState>
  onColumnSizingChange?: OnChangeFn<ColumnSizingState>
  onColumnOrderChange?: OnChangeFn<ColumnOrderState>
  onRowOrderChange?: OnChangeFn<TData[]>
  onColumnSortingChange?: OnChangeFn<ColumnSort[]>
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  onRowExpandedChange?: OnChangeFn<ExpandedState>
  onGroupingChange?: OnChangeFn<GroupingState>
}

// Опции ядра, НЕ относящиеся к плагинам (фичи включаются через `plugins`,
// см. ADR 0010). skeleton/loading/rowActions/footer — ядровые (rowActions пока
// не вынесена в плагин).
export interface CreateDataGridOptions<TData = any, TOptions = any> {
  enableSkeleton?: TableOptions<TData>['enableSkeleton']
  enableLoading?: TableOptions<TData>['enableLoading']

  enableRowActions?: TableOptions<TData>['enableRowActions']
  enableFooter?: TableOptions<TData>['enableFooter']

  rowActionsOptions?: RowActionsOptions
  skeletonOptions?: SkeletonOptions

  handlers?: CreateDataGridHandlers<TData> & TOptions
}

export interface CreateDataGridParams<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
> extends CreateDataGridOptions<TData, TOptions> {
  columns: AccessorKeyColumnDef<TData, unknown, THooks, TState, TOptions>[]
  data: TableOptions<TData>['data']

  state?: Partial<TableState> & TState
  hooks?: Partial<PluginsHooks> & THooks
  /**
   * Presence-based композиция плагинов (ADR 0010). Наличие фабрики = фича
   * включена; отключить конкретный плагин можно через `фабрика({ enabled: false })`.
   * Falsy-записи игнорируются.
   */
  plugins?: (RegistryEntry | false | null | undefined)[]

  debug?: boolean
  defaultColumn?: ColumnSizingColumnDef
}
