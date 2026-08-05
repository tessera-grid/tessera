import {
  AccessorColumnDef,
  AccessorFn,
  AccessorKeyColumnDef,
  ColumnDefBase,
  ColumnDefTemplate,
  DeepKeys,
  DeepValue,
  GroupColumnDef,
  StringHeaderIdentifier,
} from '@tanstack/react-table'

import { CellContextSDK } from './cell'
import { HeaderContextSDK } from './header'

export interface ColumnSDK {
  getCanDrag: () => boolean

  /**
   * Метод получения индекса колонки из массива колонок, которые могут перетаскиваться, игнорируя индексы остальных колонок
   * То есть, если колонка под индексом 0 не перетаскиваемая, а колонка под индексом 1 - перетаскиваемая,
   * то метод getDraggableIndex для колонки под индексом 0 вернет значение -1, а то для колонки под индексом 1 вернет значение 0
   */
  getDraggableIndex: () => number

  getIsActionsColumn: () => boolean
  getIsRowActionsColumn: () => boolean
}

export type ColumnDefSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> =
  | ({
      cell?: ColumnDefTemplate<
        CellContextSDK<TData, TValue, THooks, TState, TOptions>
      >
    } & GroupColumnDef<TData, TValue, THooks, TState, TOptions>)
  | AccessorColumnDef<TData, TValue>

export interface GroupingColumnDefSDK {
  rowSpan?: number
}

export interface ColumnDefBaseSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  cell?:
    | string
    | ((props: CellContextSDK<TData, TValue, THooks, TState, TOptions>) => any)
  enableDragging?: boolean
}

interface IdIdentifierSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  id: string
  header?:
    | string
    | ((
        props: HeaderContextSDK<TData, TValue, THooks, TState, TOptions>,
      ) => any)
}

type ColumnIdentifiersSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> =
  | IdIdentifierSDK<TData, TValue, THooks, TState, TOptions>
  | StringHeaderIdentifier

type DisplayColumnDefSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> = Omit<ColumnDefBase<TData, TValue>, 'cell'> &
  ColumnDefBaseSDK<TData, TValue, THooks, TState, TOptions> &
  ColumnIdentifiersSDK<TData, TValue, THooks, TState, TOptions>

interface IdentifiedColumnDefSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  id?: string
  header?:
    | string
    | ((
        props: HeaderContextSDK<TData, TValue, THooks, TState, TOptions>,
      ) => any)
  cell?:
    | string
    | ((props: CellContextSDK<TData, TValue, THooks, TState, TOptions>) => any)
  enableDragging?: boolean
}

export interface AccessorKeyColumnDefBaseSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> extends ColumnDefBaseSDK<TData, TValue, THooks, TState, TOptions> {
  id?: string
  accessorKey: (string & Record<any, any>) | keyof TData
}

export type AccessorKeyColumnDefSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> = AccessorKeyColumnDefBaseSDK<TData, TValue, THooks, TState, TOptions> &
  Partial<ColumnIdentifiersSDK<TData, TValue, THooks, TState, TOptions>>

export interface ColumnHelperSDK<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  accessor: <
    TAccessor extends AccessorFn<TData> | DeepKeys<TData>,
    _TValue extends (TAccessor extends AccessorFn<TData, infer TReturn>
      ? TReturn
      : TAccessor extends DeepKeys<TData>
        ? DeepValue<TData, TAccessor>
        : never),
  >(
    accessor: TAccessor,
    column:
      | DisplayColumnDefSDK<TData, unknown, THooks, TState, TOptions>
      | IdentifiedColumnDefSDK<TData, unknown, THooks, TState, TOptions>,
  ) => AccessorKeyColumnDef<TData, unknown, THooks, TState, TOptions>
  display: (
    column: DisplayColumnDefSDK<TData, unknown, THooks, TState, TOptions>,
  ) => DisplayColumnDefSDK<TData, unknown, THooks, TState, TOptions>
  group: (
    column: GroupColumnDef<TData, unknown, THooks, TState, TOptions>,
  ) => GroupColumnDef<TData, unknown, THooks, TState, TOptions>
}
