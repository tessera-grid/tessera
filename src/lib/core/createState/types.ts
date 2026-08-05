import {
  AccessorKeyColumnDef,
  TableOptions,
  TableState,
} from '@tanstack/react-table'

import { CreateDataGridHandlers } from '../createTable'

export interface CreateStateParams<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  columns: AccessorKeyColumnDef<TData, unknown, THooks, TState, TOptions>[]
  state: Partial<TableState> & TState
  handlers: CreateDataGridHandlers<TData> & TOptions
  enableRowSelection: TableOptions<TData>['enableRowSelection']
  enableRowExpanding: TableOptions<TData>['enableRowExpanding']
  enableRowDragging: TableOptions<TData>['enableRowDragging']
  enableRowActions: TableOptions<TData>['enableRowActions']
}
