import {
  AccessorKeyColumnDef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingColumnDef,
  ColumnSizingState,
  ColumnSort,
  ExpandedState,
  GroupingState,
  OnChangeFn,
  RowSelectionState,
  TableOptions,
  TableState,
  VisibilityState,
} from '@tanstack/react-table'

import { InferPluginHooks, PluginEntryInput } from '../pluginContract'
import { SkeletonOptions } from '../skeletonOverlay/types'

export interface CreateDataGridHandlers<TData = any> {
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  onColumnPinningChange?: OnChangeFn<ColumnPinningState>
  onColumnSizingChange?: OnChangeFn<ColumnSizingState>
  onColumnOrderChange?: OnChangeFn<ColumnOrderState>
  onRowOrderChange?: OnChangeFn<TData[]>
  onColumnSortingChange?: OnChangeFn<ColumnSort[]>
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  onRowExpandedChange?: OnChangeFn<ExpandedState>
  onGroupingChange?: OnChangeFn<GroupingState>
}

// Опции ядра, НЕ относящиеся к плагинам (фичи включаются через `plugins`,
// см. ADR 0010). skeleton/loading/footer — ядровые. rowActions вынесена в
// плагин (@mstrvtt/tessera/plugins), автосайз/предикаты остаются в ядре.
export interface CreateDataGridOptions<TData = any, TOptions = any> {
  enableSkeleton?: TableOptions<TData>['enableSkeleton']
  enableLoading?: TableOptions<TData>['enableLoading']

  enableFooter?: TableOptions<TData>['enableFooter']

  skeletonOptions?: SkeletonOptions

  handlers?: CreateDataGridHandlers<TData> & TOptions
}

export interface CreateDataGridParams<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
  TPlugins extends readonly PluginEntryInput[] = readonly PluginEntryInput[],
> extends CreateDataGridOptions<TData, TOptions> {
  columns: AccessorKeyColumnDef<TData, unknown, THooks, TState, TOptions>[]
  data: TableOptions<TData>['data']

  state?: Partial<TableState> & TState
  /**
   * Контракт хуков (types-mode b, ADR 0010). Встроенные слайсы выводятся из
   * набора `plugins` (`InferPluginHooks`) — presence-based, работает в вызове
   * БЕЗ явных generic-аргументов. Кастомные хуки идут через `THooks`. При явных
   * дженериках вывод из кортежа не срабатывает — типизируйте `hooks` через
   * `BuiltinPluginsHooks` из `@mstrvtt/tessera/plugins`.
   */
  hooks?: Partial<InferPluginHooks<TPlugins>> & THooks
  /**
   * Presence-based композиция плагинов (ADR 0010). Наличие фабрики = фича
   * включена; отключить конкретный плагин можно через `фабрика({ enabled: false })`.
   * Falsy-записи игнорируются.
   */
  plugins?: TPlugins

  debug?: boolean
  defaultColumn?: ColumnSizingColumnDef
}
