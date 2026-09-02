import { useMemo } from 'react'

import {
  TableState,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { RegistryEntry, ServiceColumn } from '../pluginContract'
import { commonPlugin } from '../commonPlugin'
import { useColumnActionsAutosize, useCreateColumns } from '../createColumns'
import {
  DEFAULT_ROW_ACTIONS_OPTIONS,
  ROW_ACTIONS_COLUMN_ID,
  getRowActionsColumn,
} from '../createColumns/createRowActionsColumn'
import { DEFAULT_COLUMN } from '../createColumns/defaultColumnOptions'
import { PluginsHooks, useCreateHooks } from '../createHooks'
import { useCreateSlots } from '../createSlots'
import { useCreateState } from '../createState'
import { DEFAULT_SKELETON_OPTIONS } from '../skeletonOverlay/options'
import { FEATURE_OFF_BASELINE, foldPluginOptions } from './pluginOptions'
import { CreateDataGridHandlers, CreateDataGridParams } from './types'
import { useRowSelectionReset } from './useRowSelectionReset'

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
  plugins = [],

  debug = false,

  enableSkeleton = false,
  skeletonOptions = DEFAULT_SKELETON_OPTIONS,

  enableLoading = false,

  enableRowActions = false,
  rowActionsOptions = DEFAULT_ROW_ACTIONS_OPTIONS,

  enableFooter = false,

  defaultColumn = DEFAULT_COLUMN,
}: CreateDataGridParams<TData, THooks, TState, TOptions>) => {
  // Presence-based композиция (ADR 0010): фичи, сервисные колонки и опции
  // выводятся из списка плагинов. Falsy-записи и отключённые (`enabled: false`)
  // отсеиваются; `common` вклеивается ядром всегда.
  const activePlugins = useMemo(
    () =>
      (plugins.filter(Boolean) as RegistryEntry[]).filter(
        plugin => plugin.enabled !== false,
      ),
    [plugins],
  )

  const features = useMemo(
    () => [commonPlugin, ...activePlugins.map(plugin => plugin.feature)],
    [activePlugins],
  )

  const pluginColumns = useMemo<ServiceColumn[]>(
    () => [
      ...activePlugins.flatMap(plugin =>
        plugin.column ? [plugin.column] : [],
      ),
      ...(enableRowActions
        ? [
            {
              id: ROW_ACTIONS_COLUMN_ID,
              make: getRowActionsColumn as ServiceColumn['make'],
              side: 'trailing' as const,
              order: 0,
              // Колонка действий — ядровая; ядро объявляет её пиннинг как владелец
              // колонки (всегда вправо). TODO: вынести rowActions в плагин.
              pin: { side: 'right' as const, when: 'always' as const },
            },
          ]
        : []),
    ],
    [activePlugins, enableRowActions],
  )

  // Сервисные колонки для ядра: id (сев видимости) + объявленный плагином pin.
  const serviceColumns = useMemo(
    () => pluginColumns.map(column => ({ id: column.id, pin: column.pin })),
    [pluginColumns],
  )

  const pluginOptions = useMemo(
    () => ({
      ...FEATURE_OFF_BASELINE,
      ...foldPluginOptions(activePlugins),
    }),
    [activePlugins],
  )

  const columns = useCreateColumns<TData, THooks, TState, TOptions>({
    initialColumns,
    pluginColumns,
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
    serviceColumns,
  })

  const hooks = useCreateHooks<THooks>(
    useMemo(
      () => externalHooks ?? ({} as PluginsHooks & THooks),
      [externalHooks],
    ),
  )
  const slots = useCreateSlots()

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

    // Фичевые опции приходят из записей плагинов (presence-based).
    ...pluginOptions,

    // Ядровые опции (не фичи) — остаются на ядре.
    enableSkeleton,
    skeletonOptions,
    enableLoading,

    enableRowActions,
    enableFooter,

    _features: features,
  })

  useRowSelectionReset({ table })
  useColumnActionsAutosize({ rowActionsOptions, onColumnAutoSizingChange })

  return table
}
