import {
  Cell,
  Column,
  ColumnDef,
  Header,
  InitialTableState,
  Row,
  Table,
  TableOptionsResolved,
} from '@tanstack/react-table'

import { CellContextSDK } from '../../types/cell'
import { HeaderContextSDK } from '../../types/header'

/**
 * @link https://tanstack.com/table/v8/docs/guide/custom-features
 */
export interface TablePlugin<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
  TValue = unknown,
> {
  /**
   * Подписка на ициниализацию инстанса ячейки
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#cell
   */
  createCell?: (
    _staticCell: Cell<TData, TValue, THooks, TState, TOptions>,
    _staticColumn: Column<TData, TValue>,
    _staticRow: Row<TData>,
    table: Table<TData, THooks, TState, TOptions>,
  ) => void
  /**
   * Подписка на ициниализацию инстанса колонки
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#column
   */
  createColumn?: (
    _staticColumn: Column<TData, TValue>,
    table: Table<TData, THooks, TState, TOptions>,
  ) => void
  /**
   * Подписка на ициниализацию инстанса заголовка колонки
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#header
   */
  createHeader?: (
    _staticHeader: Header<TData, TValue, THooks, TState, TOptions>,
    table: Table<TData, THooks, TState, TOptions>,
  ) => void
  /**
   * Подписка на ициниализацию инстанса строки
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#row
   */
  createRow?: (
    _staticRow: Row<TData>,
    table: Table<TData, THooks, TState, TOptions>,
  ) => void
  /**
   * Подписка на ициниализацию инстанса таблицы
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#createtable
   */
  createTable?: (table: Table<TData, THooks, TState, TOptions>) => void
  /**
   * Метод для установки параметров колонок таблицы по умолчанию
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#getdefaultcolumndef
   */
  getDefaultColumnDef?: () => Partial<ColumnDef<TData>>
  /**
   * Метод для установки параметров таблицы
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#getdefaultoptions
   */
  getDefaultOptions?: (
    table: Table<TData, THooks, TState, TOptions>,
  ) => Partial<TableOptionsResolved<TData>> & TOptions
  /**
   * Метод для установки состояния таблицы по умолчанию
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#getinitialstate
   */
  getInitialState?: (
    initialState?: InitialTableState | undefined,
  ) => InitialTableState & TState
}

/**
 * Тип для описания компонента заголовков
 */
export type HeaderComponentProps<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
  TValue = unknown,
> = HeaderContextSDK<TData, TValue, THooks, TState, TOptions>

/**
 * Тип для описания компонента ячеек
 */
export type CellComponentProps<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
  TValue = unknown,
> = CellContextSDK<TData, TValue, THooks, TState, TOptions>
