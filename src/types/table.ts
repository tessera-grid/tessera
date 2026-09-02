import {
  ColumnSizingState,
  TableOptionsResolved,
  TableState,
  Updater,
} from '@tanstack/react-table'

import { PluginsHooks } from '../lib/core/createHooks/types'
import {
  RegisterCellSlotParams,
  RegisterHeaderSlotParams,
  RenderSlots,
} from '../lib/core/createSlots'

// Интерфейс глобальных методов таблицы
export interface TableSDK<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  initialState: TableState & TState
  getState: () => TableState & TState
  setState: (updater: Updater<TableState & TState>) => void
  options: TableOptionsResolved<TData, THooks, TState, TOptions> & TOptions

  /**
   * Метод получения набора функций и признаков, определяющих бизнес-контекст текущей таблицы
   */
  getHooks: () => PluginsHooks & THooks

  /**
   * Метод получения всех слотов таблицы и их содержимого
   */
  getRenderSlots: () => RenderSlots

  /**
   * Метод регистрации плагина в определенном слоте таблицы
   */
  setRenderSlot: (
    params:
      | Omit<RegisterHeaderSlotParams<TData, THooks, TState, TOptions>, 'table'>
      | Omit<RegisterCellSlotParams<TData, THooks, TState, TOptions>, 'table'>,
  ) => void

  getIsAnyColumnResizing: () => boolean

  /**
   * Записать авто-слайс размеров колонок (generic-механизм ADR 0010). Применяется
   * поверх пользовательского/контролируемого columnSizing; плагины вызывают его
   * в `setup` (напр. rowActions задаёт ширину колонки действий).
   */
  setColumnAutoSizing: (updater: Updater<ColumnSizingState>) => void
}
