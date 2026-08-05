import { ComponentType } from 'react'

import { Cell, Column, Getter, Row, Table } from '@tanstack/react-table'

import { TableSDK } from './table'

export interface CellSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  /**
   * Метод отрисовки контента внутри ячейки
   * @deprecated Используйте renderComponent
   */
  render: (context: {
    cell: Omit<Cell<TData, TValue>, 'getContext'> &
      CellSDK<TData, TValue, THooks, TState, TOptions>
    column: Column<TData, TValue>
    getValue: Getter<TValue>
    renderValue: Getter<TValue | null>
    row: Row<TData>
    table: Omit<
      Table<TData>,
      'initialState' | 'getState' | 'setState' | 'options'
    > &
      TableSDK<TData, THooks, TState, TOptions>
  }) => any

  renderComponent?: ComponentType<{
    cell: Omit<Cell<TData, TValue>, 'getContext'> &
      CellSDK<TData, TValue, THooks, TState, TOptions>
    column: Column<TData, TValue>
    getValue: Getter<TValue>
    renderValue: Getter<TValue | null>
    row: Row<TData>
    table: Omit<
      Table<TData>,
      'initialState' | 'getState' | 'setState' | 'options'
    > &
      TableSDK<TData, THooks, TState, TOptions>
  }>

  /**
   * Метод получения контекста таблицы для доступа ко всем ее параметрам и состояниям
   */
  getContext: () => {
    cell: Omit<Cell<TData, TValue>, 'getContext'> &
      CellSDK<TData, TValue, THooks, TState, TOptions>
    column: Column<TData, TValue>
    getValue: Getter<TValue>
    renderValue: Getter<TValue | null>
    row: Row<TData>
    table: Omit<
      Table<TData>,
      'initialState' | 'getState' | 'setState' | 'options'
    > &
      TableSDK<TData, THooks, TState, TOptions>
  }
}

export interface CellContextSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  cell: Omit<Cell<TData, TValue>, 'getContext'> &
    CellSDK<TData, TValue, THooks, TState, TOptions>
  column: Column<TData, TValue>
  getValue: Getter<TValue>
  renderValue: Getter<TValue | null>
  row: Row<TData>
  table: Omit<
    Table<TData>,
    'initialState' | 'getState' | 'setState' | 'options'
  > &
    TableSDK<TData, THooks, TState, TOptions>
}
