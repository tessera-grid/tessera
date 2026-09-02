import { Table } from '@tanstack/react-table'

import { CellComponentProps, HeaderComponentProps } from '../pluginContract'
import { RegisterSlotParams, RenderSlots } from './types'

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
 * Метод регистрации плагина. Позволяет задать конкретный слот, порядок отображения плагина и возвращаемый JSX.
 */
export const registerSlot = ({
  id,
  order,
  visible = true,
  slot,
  render,
  component,
  table,
}: RegisterHeaderSlotParams | RegisterCellSlotParams) => {
  const slots = table.getRenderSlots()

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
