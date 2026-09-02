import { AccessorKeyColumnDef, TableState } from '@tanstack/react-table'

import { ServiceColumn } from '../pluginContract'
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
  /**
   * Сервисные колонки (id + объявленный плагином пиннинг), принесённые плагинами
   * и ядром. Ядро сеет их видимость по наличию и исполняет объявленный `pin`
   * (ADR 0010).
   */
  serviceColumns: { id: string; pin?: ServiceColumn['pin'] }[]
}
