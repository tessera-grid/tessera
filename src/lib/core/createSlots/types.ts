import { ColumnDefTemplate } from '@tanstack/react-table'

import { CellComponentProps, HeaderComponentProps } from '../pluginContract'

export interface RegisterSlotParams<TContext extends object> {
  /**
   * Уникальный идентификатор плагина (ключ не должен быть динамическим)
   */
  id: string
  /**
   * Порядок, в котором будет располагаться плагин относительно соседних плагинов
   */
  order?: number | 'last'
  /**
   * Внешний признак видимости плагина
   * @deprecated Используйте условный рендеринг внутри component
   */
  visible?: boolean
  /**
   * Функция отрисовки JSX плагина
   * @deprecated Используйте component
   */
  render?: ColumnDefTemplate<TContext>
  /**
   * Компонент плагина
   */
  component?: (props: TContext) => any
}

export type HeaderSlot = RegisterSlotParams<HeaderComponentProps>[]

export type CellSlot = RegisterSlotParams<CellComponentProps>[]

/**
 * Декларативное объявление слота плагином (ADR 0010). Плагин НЕ регистрирует
 * слот императивно в `createTable` (тот выполняется один раз при конструировании
 * таблицы и не переигрывается при смене активного набора), а объявляет его в
 * записи реестра — ядро собирает слоты реактивно из активных плагинов, поэтому
 * появление/исчезновение кнопки точно следует за наличием плагина.
 */
export type PluginSlot =
  | (RegisterSlotParams<HeaderComponentProps> & {
    slot: 'leftHeaderSlot' | 'rightHeaderSlot'
  })
  | (RegisterSlotParams<CellComponentProps> & {
    slot: 'leftCellSlot' | 'rightCellSlot' | 'actionRowSlot'
  })

export interface RenderSlots {
  /**
   * Место под плагин в заголовке колонки слева от текста
   */
  leftHeaderSlot: HeaderSlot
  /**
   * Место под плагин в заголовке колонки справа от текста
   */
  rightHeaderSlot: HeaderSlot
  /**
   * Место под плагин в ячейке слева от текста
   */
  leftCellSlot: CellSlot
  /**
   * Место под плагин в ячейке справа от текста
   */
  rightCellSlot: CellSlot
  /**
   * Место под кнопки действий над строками
   */
  actionRowSlot: CellSlot
}
