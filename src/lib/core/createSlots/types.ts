/**
 * Типы слот-машинерии. Контекст слота — `HeaderContext`/`CellContext`; поле
 * `render` (`ColumnDefTemplate`) оставлено для совместимости, но НЕ путь рендера —
 * рендер идёт через нативный `FlexRender` (см. `component`).
 */
import type {
  CellContext,
  ColumnDefTemplate,
  HeaderContext,
  Table,
} from '../../types'

/** Пропсы компонента слота заголовка — v9-контекст заголовка. */
export type HeaderComponentProps = HeaderContext<any, any, any>
/** Пропсы компонента слота ячейки/строки — v9-контекст ячейки. */
export type CellComponentProps = CellContext<any, any, any>
/** Пропсы компонента кнопки тулбара — таблица целиком (контекста колонки нет). */
export interface ToolbarComponentProps {
  table: Table<any, any>
}
/** Пропсы компонента нижней панели — как у тулбара, таблица целиком. */
export type StatusBarComponentProps = ToolbarComponentProps

export interface RegisterSlotParams<TContext extends object> {
  /** Уникальный идентификатор плагина (ключ не должен быть динамическим). */
  id: string
  /** Порядок относительно соседних плагинов в слоте. */
  order?: number | 'last'
  /**
   * Внешний признак видимости.
   * @deprecated Используйте условный рендеринг внутри `component`.
   */
  visible?: boolean
  /**
   * Функция отрисовки JSX.
   * @deprecated В v9 рендер идёт через `FlexRender`; используйте `component`.
   */
  render?: ColumnDefTemplate<TContext>
  /** Компонент плагина. */
  component?: (props: TContext) => any
  /**
   * Учитывать ли слот в пороге схлопывания кебаб-меню. `false` — слот-аффорданс
   * (напр. resize-грип), не занимающий место в счётчике. По умолчанию учитывается.
   */
  countsAsHeaderAction?: boolean
  /** Подгруппа кнопок тулбара (только `toolbarSlot`); по умолчанию `'default'`. */
  group?: string
  /** Сторона нижней панели (только `statusBarSlot`); по умолчанию `'start'`. */
  align?: 'start' | 'end'
  /** `id` плагина-владельца; проставляет ядро при свёртке (граница ошибок, ADR 0037). */
  pluginId?: string
}

export type HeaderSlot = RegisterSlotParams<HeaderComponentProps>[]

export type CellSlot = RegisterSlotParams<CellComponentProps>[]

export type ToolbarSlot = RegisterSlotParams<ToolbarComponentProps>[]

export type StatusBarSlot = RegisterSlotParams<StatusBarComponentProps>[]

/**
 * Декларативное объявление слота плагином. Ядро собирает слоты
 * реактивно из активных плагинов — появление/исчезновение кнопки следует за
 * наличием плагина.
 */
export type PluginSlot =
  | (RegisterSlotParams<HeaderComponentProps> & {
      slot: 'leftHeaderSlot' | 'rightHeaderSlot'
    })
  | (RegisterSlotParams<CellComponentProps> & {
      slot: 'leftCellSlot' | 'rightCellSlot' | 'actionRowSlot' | 'cellSlot'
    })
  | (RegisterSlotParams<ToolbarComponentProps> & { slot: 'toolbarSlot' })
  | (RegisterSlotParams<StatusBarComponentProps> & { slot: 'statusBarSlot' })

export interface RenderSlots {
  /** Место под плагин в заголовке колонки слева от текста. */
  leftHeaderSlot: HeaderSlot
  /** Место под плагин в заголовке колонки справа от текста. */
  rightHeaderSlot: HeaderSlot
  /** Место под плагин в ячейке слева от текста. */
  leftCellSlot: CellSlot
  /** Место под плагин в ячейке справа от текста. */
  rightCellSlot: CellSlot
  /**
   * Владелец контента ячейки: компонент получает собственный рендер ячейки пропсом
   * `content` и рантайм решает — показать его как есть или заместить своим (напр.
   * инлайн-редактор cellEditing). Единственный канал, подавляющий `{render}`.
   */
  cellSlot: CellSlot
  /** Место под кнопки действий над строками. */
  actionRowSlot: CellSlot
  /** Кнопки верхнего тулбара таблицы (ADR 0035). */
  toolbarSlot: ToolbarSlot
  /** Сведения о данных в нижней панели под таблицей (ADR 0038). */
  statusBarSlot: StatusBarSlot
}
