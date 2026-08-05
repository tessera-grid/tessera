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

import { TablePlugin } from '../../plugins/types'
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

export interface CreateDataGridOptions<TData = any, TOptions = any> {
  enableColumnPinning?: boolean

  enableColumnResizing?: boolean

  enableColumnSorting?: boolean
  enableSortingRemoval?: boolean
  serverColumnSorting?: boolean

  enableColumnDragging?: boolean
  enableRowDragging?: TableOptions<TData>['enableRowDragging']

  enableRowExpanding?: TableOptions<TData>['enableRowExpanding']

  enableRowSelection?: TableOptions<TData>['enableRowSelection']
  enableSubRowSelection?: TableOptions<TData>['enableSubRowSelection']

  enableGrouping?: TableOptions<TData>['enableGrouping']

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
  plugins?: TablePlugin[]

  debug?: boolean
  defaultColumn?: ColumnSizingColumnDef
}
