import { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { OnChangeFn, Row, TableState } from '@tanstack/react-table'

import { PluginsHooks } from '../lib/core/createHooks/types'
import { RenderSlots } from '../lib/core/createSlots'
import { RowActionsOptions } from '../lib/core/createColumns/createRowActionsColumn'
import { SkeletonOptions } from '../lib/core/skeletonOverlay/types'
import { ColumnDraggingOptions } from '../lib/plugins/columnDragging'
import { RowDraggingOptions } from '../lib/plugins/rowDragging'
import { TableStateSDK } from './state'

// Интерфейс параметров таблицы, получаемые через table.options
export interface TableOptionsResolvedSDK<
  TData = any,
  THooks = any,
  TState = any,
  _TOptions = any,
>
  extends ColumnDraggingOptions, RowDraggingOptions {
  initialState?: TableState & TableStateSDK & TState
  state: Partial<TableState & TableStateSDK> & TState

  hooks: PluginsHooks & THooks
  slots: RenderSlots

  // _features: TablePlugin[]

  enableSkeleton?: boolean
  enableLoading?: boolean

  enableRowActions?: boolean
  rowActionsOptions?: RowActionsOptions
  enableFooter?: boolean

  // eslint-disable-next-line no-use-before-define
  enableRowExpanding?: boolean | ((row: Row<TData>) => boolean)
  maxExpandingDepth: number

  skeletonOptions: SkeletonOptions

  enableColumnDragging?: boolean
  onColumnDragStart?: (event: DragStartEvent) => void
  onColumnDragEnd?: (event: DragEndEvent) => void

  // eslint-disable-next-line no-use-before-define
  enableRowDragging?: boolean | ((row: Row<TData>) => boolean)
  onRowOrderChange?: OnChangeFn<TData[]>
}
