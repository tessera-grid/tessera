import { ComponentType } from 'react'

import { Column, Header, Table } from '@tanstack/react-table'

export interface HeaderContextSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  column: Column<TData, TValue>
  header: Header<TData, TValue, THooks, TState, TOptions>
  table: Table<TData, THooks, TState, TOptions>
}

export interface HeaderGroupSDK {
  getIsFirstGroup: () => boolean
  getIsLastGroup: () => boolean
}

export interface HeaderSDK<
  TData = any,
  TValue = unknown,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  /**
   * Метод отрисовки контента внутри заголовка колонки
   * @deprecated Используйте renderComponent
   */
  render: (context: {
    column: Column<TData, TValue>
    header: Header<TData, TValue, THooks, TState, TOptions>
    table: Table<TData, THooks, TState, TOptions>
  }) => any

  renderComponent?: ComponentType<{
    column: Column<TData, TValue>
    header: Header<TData, TValue, THooks, TState, TOptions>
    table: Table<TData, THooks, TState, TOptions>
  }>

  /**
   * Метод получения контекста таблицы для доступа ко всем ее параметрам и состояниям
   */
  getContext: () => {
    column: Column<TData, TValue>
    header: Header<TData, TValue, THooks, TState, TOptions>
    table: Table<TData, THooks, TState, TOptions>
  }

  getIsFirstHeader: () => boolean
  getIsLastHeader: () => boolean
  getIsFullHeightHeader: () => boolean
}
