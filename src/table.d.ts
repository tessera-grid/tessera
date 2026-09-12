import { RowData, Table as TanstackTable } from '@tanstack/react-table'

import type { PinSides } from './lib/plugins/columnPinning/types'
import { CellContextSDK, CellSDK } from './types/cell'
import {
  AccessorKeyColumnDefBaseSDK,
  AccessorKeyColumnDefSDK,
  ColumnDefBaseSDK,
  ColumnDefSDK,
  ColumnHelperSDK,
  ColumnSDK,
  GroupingColumnDefSDK,
} from './types/column'
import { HeaderContextSDK, HeaderGroupSDK, HeaderSDK } from './types/header'
import { TableOptionsResolvedSDK } from './types/options'
import { RowSDK, RowSelectionInstanceSDK } from './types/row'
import { TableStateSDK } from './types/state'
import { TableSDK } from './types/table'

/**
 * @link https://tanstack.com/table/latest/docs/framework/react/examples/custom-features
 */
declare module '@tanstack/react-table' {
  interface TableState extends TableStateSDK {}

  interface TableOptionsResolved<
    TData = any,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends TableOptionsResolvedSDK<TData, THooks, TState, TOptions> {}

  interface Table<
    TData = any,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends TableSDK<TData, THooks, TState, TOptions> {}

  declare function useReactTable<
    TData = any,
    THooks = any,
    TState = any,
    TOptions = any,
  >(
    options: Omit<TableOptionsResolved, 'initialState' | 'state'> &
      TableOptionsResolvedSDK<TData, THooks, TState, TOptions>,
  ): Omit<
    TanstackTable<TData>,
    'initialState' | 'getState' | 'setState' | 'options'
  > &
    TableSDK

  /** Column * */

  interface Column extends ColumnSDK {}

  // Индекс-сигнатура сохраняет исходную «свободную» семантику meta (в неё кладут
  // произвольные поля, напр. FieldType в Guide), а типизированный `pinSides`
  // добавляет опцию плагина columnPinning (ADR 0011): какие стороны закрепления
  // предлагать в UI для столбца (`both` | `left` | `right`, по умолчанию `both`).
  // Имена параметров (`TData`/`TValue`) обязаны совпадать с оригинальной
  // ColumnMeta TanStack — иначе declaration merging не склеит augmentation.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    pinSides?: PinSides
    [key: string]: unknown
  }

  interface GroupingColumnDef extends GroupingColumnDefSDK {}

  type ColumnDef<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > = ColumnDefSDK<TData, TValue, THooks, TState, TOptions>

  interface ColumnDefBase<
    TData = any,
    _TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends ColumnDefBaseSDK<TData, THooks, TState, TOptions> {}

  interface GroupColumnDefBase<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends ColumnDefBaseSDK<TData, TValue, THooks, TState, TOptions> {
    columns?: ColumnDefSDK<TData, TValue, THooks, TState, TOptions>[]
  }

  type GroupColumnDef<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > = GroupColumnDefBase<TData, TValue, THooks, TState, TOptions> &
    ColumnIdentifiers<TData, TValue>

  interface AccessorKeyColumnDefBase<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends AccessorKeyColumnDefBaseSDK<
    TData,
    TValue,
    THooks,
    TState,
    TOptions
  > {}

  type AccessorKeyColumnDef<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > = AccessorKeyColumnDefSDK<TData, TValue, THooks, TState, TOptions>

  interface AccessorKeyColumnDefBase<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends AccessorKeyColumnDefBaseSDK<
    TData,
    TValue,
    THooks,
    TState,
    TOptions
  > {}

  interface ColumnHelper<
    TData = any,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends ColumnHelperSDK<TData, THooks, TState, TOptions> {}

  declare function createColumnHelper<
    TData = any,
    THooks = any,
    TState = any,
    TOptions = any,
  >(): ColumnHelper<TData, THooks, TState, TOptions>

  /** Row * */

  interface Row extends RowSDK {}
  interface RowSelectionInstance extends RowSelectionInstanceSDK {}

  /** Header * */

  interface HeaderContext<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends HeaderContextSDK<TData, TValue, THooks, TState, TOptions> {}

  interface Header<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends HeaderSDK<TData, TValue, THooks, TState, TOptions> {}

  interface HeaderGroup extends HeaderGroupSDK {}

  /** Cell * */

  interface CellContext<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends CellContextSDK<TData, TValue, THooks, TState, TOptions> {}

  interface Cell<
    TData = any,
    TValue = unknown,
    THooks = any,
    TState = any,
    TOptions = any,
  > extends CellSDK<TData, TValue, THooks, TState, TOptions> {}
}
