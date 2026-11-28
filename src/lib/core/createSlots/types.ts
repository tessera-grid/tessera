/**
 * Типы слот-машинерии. Контекст слота — `HeaderContext`/`CellContext`; поле
 * `render` (`ColumnDefTemplate`) оставлено для совместимости, но НЕ путь рендера —
 * рендер идёт через нативный `FlexRender` (см. `component`).
 */
import type { ReactNode } from 'react'

import type { VirtualItem } from '../../../vendor/tanstack-virtual/react-virtual'

import type {
  CellContext,
  Column,
  ColumnDefTemplate,
  HeaderContext,
  Table,
} from '../../types'

/** Props of a header slot component — the v9 header context. */
export type HeaderComponentProps = HeaderContext<any, any, any>
/** Props of a cell or row slot component — the v9 cell context. */
export type CellComponentProps = CellContext<any, any, any>
/** Props of a toolbar button component — the whole table (no column context). */
export interface ToolbarComponentProps {
  table: Table<any, any>
}
/** Props of a status bar component — like the toolbar, the whole table. */
export type StatusBarComponentProps = ToolbarComponentProps
/**
 * Props of a component at the end of the body (ADR 0081): rows outside the model repeat the
 * widths, pinning and column virtualization window of the body.
 */
export interface BodyEndComponentProps {
  table: Table<any, any>
  leafColumns: Column<any, any, unknown>[]
  virtualColumns: VirtualItem[]
  /** `aria-rowindex` of the row right after the last body row. */
  nextAriaRowIndex: number
  /** Skeleton rows after the body — rendered like body rows (ADR 0170, §2). */
  renderSkeletonRows: (request: SkeletonRowsRequest) => ReactNode
}

export interface SkeletonRowsRequest {
  rowCount: number
  /** Number of the first row in the body: stripe parity continues the body. */
  firstRowIndex: number
  className?: string
  /** `false` — rows outside the scroll area: only their height, no cells. */
  cells?: boolean
}

export interface RegisterSlotParams<TContext extends object> {
  /** Unique plugin id (the key must not be dynamic). */
  id: string
  /** Order relative to neighboring plugins in the slot. */
  order?: number | 'last'
  /**
   * External visibility flag.
   * @deprecated Use conditional rendering inside `component`.
   */
  visible?: boolean
  /**
   * JSX render function.
   * @deprecated In v9 rendering goes through `FlexRender`; use `component`.
   */
  render?: ColumnDefTemplate<TContext>
  /** The plugin's component. */
  component?: (props: TContext) => any
  /**
   * Whether the slot counts toward the kebab-menu collapse threshold. `false` is an affordance
   * slot (for example, a resize grip) that doesn't take a place in the count. Counted by default.
   */
  countsAsHeaderAction?: boolean
  /** Toolbar button subgroup (`toolbarSlot` only); `'default'` by default. */
  group?: string
  /**
   * Side of the status bar or toolbar (`statusBarSlot`, `toolbarSlot`). Defaults to `'start'`
   * for the status bar and `'end'` for the toolbar (buttons aligned right).
   */
  align?: 'start' | 'end'
  /**
   * Whether the entry makes the status bar appear (`statusBarSlot`, ADR 0082). `false` — the
   * entry renders in a status bar shown by other entries or the flag, but doesn't keep it shown.
   */
  showsPanel?: boolean
  /** `id` of the owner plugin; the core sets it when folding plugins (error boundary, ADR 0037). */
  pluginId?: string
}

export type HeaderSlot = RegisterSlotParams<HeaderComponentProps>[]

export type CellSlot = RegisterSlotParams<CellComponentProps>[]

export type ToolbarSlot = RegisterSlotParams<ToolbarComponentProps>[]

export type StatusBarSlot = RegisterSlotParams<StatusBarComponentProps>[]

export type BodyEndSlot = RegisterSlotParams<BodyEndComponentProps>[]

/**
 * A plugin's declarative slot. The core collects slots reactively from active plugins, so a
 * button appears and disappears with its plugin.
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
  | (RegisterSlotParams<BodyEndComponentProps> & {
      slot: 'bodyEndSlot' | 'tableEndSlot'
    })

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
  /** Строки после последней строки тела, вне модели (ADR 0081). */
  bodyEndSlot: BodyEndSlot
  /**
   * Строки в конце таблицы: до закреплённого футера, после незакреплённого
   * (ADR 0118, §3).
   */
  tableEndSlot: BodyEndSlot
}
