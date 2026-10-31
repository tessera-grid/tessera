/**
 * Обёртки и декораторы плагинов (ADR 0168, §2): чем плагин перетаскивания встраивается в
 * тело и шапку грида. Внутренние: в публичный `PluginSlot` не входят.
 */
import type { ComponentType, ReactNode, Ref } from 'react'

import type { Header, Row, Table } from '../types'

/** Что строка тела рисует за декоратор перетаскивания. */
export interface RowDragBinding {
  /** Элемент строки: декоратор сдвигает его сам. */
  setNodeRef: (element: HTMLElement | null) => void
  dragging: boolean
  /** Указатель над незагруженной строкой: слота нет (ADR 0159, §3). */
  slotHidden: boolean
  /** Строка — не место броска. */
  interacting: boolean
  /** Перенос строки ждёт промиса (ADR 0112). */
  busy: boolean
}

/** Что незагруженная строка серверной модели рисует за декоратор: место броска. */
export interface PendingRowDragBinding {
  setNodeRef: (element: HTMLElement | null) => void
}

/** Что ячейка шапки рисует за декоратор перетаскивания. */
export interface HeadDragBinding {
  setNodeRef: (element: HTMLElement | null) => void
  /** Сдвиг ячейки по x, px. */
  transformX: number
  /** Ячейка — под облаком: скрыта на своём месте. */
  dragging: boolean
  /** Перенос узла ждёт промиса (ADR 0114). */
  busy: boolean
}

export interface BodyBoundaryProps {
  table: Table<any, any>
  /** Окно виртуализатора строк. */
  virtualRows: readonly { index: number }[]
  /** Облако перетаскиваемой строки рисует грид; ручку в нём даёт плагин. */
  renderCloud: (
    row: Row<any, any>,
    options: { ref: Ref<HTMLDivElement>; handle: ReactNode },
  ) => ReactNode
  children: ReactNode
}

export interface HeadBoundaryProps {
  table: Table<any, any>
  /** Облако перетаскиваемой колонки рисует грид. */
  renderCloud: (header: Header<any, any, unknown>) => ReactNode
  children: ReactNode
}

export interface HeadSeriesProps {
  /** id заголовков серии соседей в строке шапки (ADR 0052). */
  ids: string[]
  children: ReactNode
}

/** Пропсы строки, которые декоратор пробрасывает строке тела как есть. */
export interface DecoratedRowProps {
  row: Row<any, any>
  virtualRow: { index: number }
  drag?: RowDragBinding
}

export type RowDecoratorProps<P extends DecoratedRowProps = DecoratedRowProps> =
  P & { Row: ComponentType<P> }

export interface DecoratedPendingRowProps {
  virtualRow: { index: number }
  drag?: PendingRowDragBinding
}

export type PendingRowDecoratorProps<
  P extends DecoratedPendingRowProps = DecoratedPendingRowProps,
> = P & { Row: ComponentType<P> }

export interface DecoratedHeadCellProps {
  header: Header<any, any, unknown>
  drag?: HeadDragBinding
}

export type HeadCellDecoratorProps<
  P extends DecoratedHeadCellProps = DecoratedHeadCellProps,
> = P & { Cell: ComponentType<P> }

export interface PluginWrapper<P> {
  id: string
  component: ComponentType<P>
}

/** Обёртки и декораторы записи плагина. */
export interface PluginWrappers {
  /** Вокруг тела; собирается и у выключенной записи — сессия доживает до отмены. */
  bodyBoundary?: PluginWrapper<BodyBoundaryProps>
  rowDecorator?: PluginWrapper<RowDecoratorProps<any>>
  pendingRowDecorator?: PluginWrapper<PendingRowDecoratorProps<any>>
  /** Вокруг шапки; собирается и у выключенной записи. */
  headBoundary?: PluginWrapper<HeadBoundaryProps>
  headSeries?: PluginWrapper<HeadSeriesProps>
  headCellDecorator?: PluginWrapper<HeadCellDecoratorProps<any>>
}

export type FoldedWrappers = {
  [K in keyof PluginWrappers]-?: NonNullable<PluginWrappers[K]>[]
}

export const createEmptyWrappers = (): FoldedWrappers => ({
  bodyBoundary: [],
  rowDecorator: [],
  pendingRowDecorator: [],
  headBoundary: [],
  headSeries: [],
  headCellDecorator: [],
})

const PRESENCE_WRAPPERS = ['bodyBoundary', 'headBoundary'] as const

/** Добавить обёртки записи; повторный `id` заменяет прежнюю на её месте. */
export const registerWrappersInto = (
  folded: FoldedWrappers,
  wrappers: PluginWrappers | undefined,
  active: boolean,
) => {
  for (const key of Object.keys(wrappers ?? {}) as (keyof PluginWrappers)[]) {
    const wrapper = wrappers?.[key]
    if (!wrapper) continue
    if (!active && !(PRESENCE_WRAPPERS as readonly string[]).includes(key))
      continue
    const list = folded[key] as PluginWrapper<unknown>[]
    const index = list.findIndex(item => item.id === wrapper.id)
    if (index === -1) list.push(wrapper as PluginWrapper<unknown>)
    else list[index] = wrapper as PluginWrapper<unknown>
  }
}

/** Фабрика плагина с внутренними обёртками в записи. */
export const withWrappers =
  <TOptions, TEntry extends object>(
    factory: (opts?: TOptions) => TEntry,
    wrappers: PluginWrappers,
  ) =>
  (opts?: TOptions): TEntry => ({ ...factory(opts), wrappers })
