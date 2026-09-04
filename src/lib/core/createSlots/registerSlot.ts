import { Table } from '@tanstack/react-table'

import { CellComponentProps, HeaderComponentProps } from '../pluginContract'
import { PluginSlot, RegisterSlotParams, RenderSlots } from './types'

export interface RegisterHeaderSlotParams<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
> extends RegisterSlotParams<
  HeaderComponentProps<TData, THooks, TState, TOptions>
> {
  /**
   * Вариант слота, в котором будет отрисован плагин
   */
  slot: keyof Pick<RenderSlots, 'leftHeaderSlot' | 'rightHeaderSlot'>
  /**
   * Инстанс таблицы для регистрации плагина
   */
  table: Table<TData, THooks, TState, TOptions>
}

export interface RegisterCellSlotParams<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
> extends RegisterSlotParams<
  CellComponentProps<TData, THooks, TState, TOptions>
> {
  /**
   * Вариант слота, в котором будет отрисован плагин
   */
  slot: keyof Pick<
    RenderSlots,
    'leftCellSlot' | 'rightCellSlot' | 'actionRowSlot'
  >
  /**
   * Инстанс таблицы для регистрации плагина
   */
  table: Table<TData, THooks, TState, TOptions>
}

/**
 * Регистрирует слот в переданный объект `RenderSlots` (чистая операция без
 * привязки к инстансу таблицы). Ядро использует её, чтобы собрать слоты
 * реактивно из декларативных объявлений активных плагинов (ADR 0010).
 */
export const registerSlotInto = (
  slots: RenderSlots,
  { id, order, visible = true, slot, render, component }: PluginSlot,
) => {
  const currentSlot = slots[slot]

  const pluginIndexInSlot = currentSlot.findIndex(plugin => plugin.id === id)
  const hasPluginInSlot = pluginIndexInSlot !== -1

  if (hasPluginInSlot) {
    currentSlot[pluginIndexInSlot].visible = visible
    currentSlot[pluginIndexInSlot].render = render
    currentSlot[pluginIndexInSlot].component = component

    return
  }

  const entry: RegisterSlotParams<any> = {
    id,
    order,
    render,
    component,
  }

  if (order === undefined || order === 'last') {
    currentSlot.push(entry)
  } else {
    currentSlot.splice(order, 0, entry)
  }
}

/**
 * Метод императивной регистрации плагина на инстансе таблицы. Оставлен как
 * generic-escape для пользовательских плагинов; выполняется в `createTable`
 * один раз при конструировании и НЕ реактивен к смене активного набора —
 * реактивное появление слота обеспечивает декларативный `slots` записи реестра.
 */
export const registerSlot = ({
  table,
  ...params
}: RegisterHeaderSlotParams | RegisterCellSlotParams) => {
  registerSlotInto(table.getRenderSlots(), params)
}
