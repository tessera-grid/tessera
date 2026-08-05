import { useMemo } from 'react'

import {
  TableState,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { columnDraggingPlugin } from '../../plugins/columnDragging'
import { columnPinningPlugin } from '../../plugins/columnPinning'
import { columnSizingPlugin } from '../../plugins/columnSizing'
import { columnSortingPlugin } from '../../plugins/columnSorting'
import { commonPlugin } from '../../plugins/common'
import { rowDraggingPlugin } from '../../plugins/rowDragging'
import {
  DEFAULT_MAX_EXPANDING_DEPTH,
  rowExpandingPlugin,
} from '../../plugins/rowExpanding'
import { rowGroupingPlugin } from '../../plugins/rowGrouping/rowGroupingPlugin'
import {
  rowSelectionPlugin,
  useRowSelectionReset,
} from '../../plugins/rowSelection'
import { useColumnActionsAutosize, useCreateColumns } from '../createColumns'
import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../createColumns/createRowActionsColumn'
import { DEFAULT_COLUMN } from '../createColumns/defaultColumnOptions'
import { PluginsHooks, useCreateHooks } from '../createHooks'
import { useCreateSlots } from '../createSlots'
import { useCreateState } from '../createState'
import { DEFAULT_SKELETON_OPTIONS } from '../skeletonOverlay/options'
import { CreateDataGridHandlers, CreateDataGridParams } from './types'

export const useCreateTable = <
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
>({
  columns: initialColumns,
  data,

  state = {} as Partial<TableState> & TState,
  handlers = {} as CreateDataGridHandlers<TData> & TOptions,
  hooks: externalHooks,
  plugins: externalPlugins = [],

  debug = false,

  enableColumnPinning = false,
  enableColumnResizing = false,

  enableColumnSorting = false,
  enableSortingRemoval = true,
  serverColumnSorting = false,

  enableColumnDragging = false,
  enableRowDragging = false,

  enableRowSelection = false,
  enableSubRowSelection = false,

  enableRowExpanding = false,

  enableGrouping = false,

  enableSkeleton = false,
  skeletonOptions = DEFAULT_SKELETON_OPTIONS,

  enableLoading = false,

  enableRowActions = false,
  rowActionsOptions = DEFAULT_ROW_ACTIONS_OPTIONS,

  enableFooter = false,

  defaultColumn = DEFAULT_COLUMN,
}: CreateDataGridParams<TData, THooks, TState, TOptions>) => {
  const columns = useCreateColumns<TData, THooks, TState, TOptions>({
    initialColumns,
    enableRowSelection,
    enableRowExpanding,
    enableRowDragging,
    enableRowActions,
  })

  const {
    coreState,
    externalState,

    coreHandlers: { onColumnAutoSizingChange, ...coreHandlers },
    externalHandlers,
  } = useCreateState<TData, THooks, TState, TOptions>({
    columns,
    state,
    handlers,
    enableRowSelection,
    enableRowExpanding,
    enableRowDragging,
    enableRowActions,
  })

  const hooks = useCreateHooks<THooks>(
    useMemo(
      () => externalHooks ?? ({} as PluginsHooks & THooks),
      [externalHooks],
    ),
  )
  const slots = useCreateSlots()

  const plugins = useMemo(
    () => [
      commonPlugin,
      rowSelectionPlugin,
      rowExpandingPlugin,
      columnPinningPlugin,
      columnSizingPlugin,
      columnSortingPlugin,
      columnDraggingPlugin,
      rowDraggingPlugin,
      rowGroupingPlugin,
      ...externalPlugins,
    ],
    [externalPlugins],
  )

  const table = useReactTable<TData, THooks, TState, TOptions>({
    columns,
    data,

    getRowId: row => row.id,
    getSubRows: row => {
      return row.subRows || []
    },

    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),

    state: {
      ...coreState,
      ...externalState,
    },

    ...coreHandlers,
    ...externalHandlers,

    defaultColumn,

    hooks,
    slots,

    debugAll: debug,

    enableColumnPinning,

    enableColumnResizing,
    columnResizeMode: 'onChange',

    enableSorting: enableColumnSorting,
    enableSortingRemoval,
    sortDescFirst: true,
    manualSorting: serverColumnSorting,

    enableRowSelection,
    enableSubRowSelection,

    enableColumnDragging,
    enableRowDragging,

    enableRowExpanding,
    autoResetExpanded: false,
    maxExpandingDepth: DEFAULT_MAX_EXPANDING_DEPTH,

    enableGrouping,
    groupedColumnMode: false,

    enableSkeleton,
    skeletonOptions,
    enableLoading,

    enableRowActions,
    enableFooter,

    _features: plugins,
  })

  useRowSelectionReset({ table })
  useColumnActionsAutosize({ rowActionsOptions, onColumnAutoSizingChange })

  return table
}
