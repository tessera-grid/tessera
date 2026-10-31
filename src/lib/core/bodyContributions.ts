/**
 * Канал вклада плагинов в тело грида (ADR 0170, §3–§4): что плагин вносит в ячейку и
 * строку тела, в корень грида и в клавиши навигации. Внутренний: в публичный
 * `PluginSlot` не входит.
 */
import {
  createElement,
  type CSSProperties,
  Fragment,
  type ReactNode,
  useMemo,
} from 'react'

import { useSelector } from '@tanstack/react-store'

import type { DropPreview } from './dragSession'
import type { RowSource } from './rowSource'
import type { Cell, Row, Table } from '../types'

/** Что вклад даёт своей цели: атрибуты, переменные стиля и `tabIndex`. */
export interface ContributionOutput {
  attrs?: Record<string, string | number | boolean | undefined>
  style?: Record<string, string>
  tabIndex?: number
}

/** Данные строки окна по вкладчикам окна: `{ [id вкладчика]: значение }`. */
export type WindowRow = Readonly<Record<string, unknown>>

export interface CellContributionContext {
  table: Table<any, any>
  cell: Cell<any, any, unknown>
  rowIndex: number
  /** Клавиатурная навигация включена у грида. */
  navigation: boolean
  window?: WindowRow
}

export interface RowContributionContext {
  table: Table<any, any>
  row: Row<any, any>
  rowIndex: number
  navigation: boolean
  window?: WindowRow
}

/** Место строки скелета в дереве (ADR 0060, ADR 0155). */
export interface SkeletonTreePlace {
  depth: number
  branch: string
  open: boolean
}

/** Ячейка, в которой вклад рисует слой: тела или скелета. */
export interface CellLayerContext {
  table: Table<any, any>
  columnId: string
  /** Колонка отступа дерева (ADR 0059). */
  isIndent: boolean
  /** Глубина строки; у слота перетаскивания — глубина места броска. */
  depth: number
  window?: WindowRow
  /** Строка скелета: первой загрузки, незагруженная или ленивых детей. */
  skeleton?: SkeletonTreePlace
}

/** Слой перед содержимым ячейки и атрибуты, которые идут с ним. */
export interface CellLayer {
  node?: ReactNode
  attrs?: ContributionOutput['attrs']
}

/**
 * Вклад в цель тела: выбор из состояния таблицы и вклад по нему. Выбор сравнивается
 * поверхностно — цель перерисовывается, только когда он изменился.
 */
export interface TargetContribution<TContext, TSelected = any> {
  id: string
  select: (state: Record<string, unknown>, context: TContext) => TSelected
  render: (selected: TSelected, context: TContext) => ContributionOutput | null
}

export type CellContribution<TSelected = any> = TargetContribution<
  CellContributionContext,
  TSelected
> & {
  /**
   * Слой перед содержимым ячейки: рисуется и в скелете первой загрузки, и при быстрой
   * прокрутке, когда слоты ячейки не рисуются.
   */
  layer?: (context: CellLayerContext) => CellLayer | null
}
export type RowContribution<TSelected = any> = TargetContribution<
  RowContributionContext,
  TSelected
>

/** Строка и ячейка под событием тела; у незагруженной строки `row` нет. */
export interface BodyEventTarget {
  table: Table<any, any>
  row?: Row<any, any>
  cell?: Cell<any, any, unknown>
  rowElement?: HTMLElement
  cellElement?: HTMLElement
}

type BodyEventHandler<E> = (event: E, target: BodyEventTarget) => void

/** События над телом, делегированные от корня грида. */
export interface BodyEvents {
  mousedown?: BodyEventHandler<MouseEvent>
  /** Указатель вошёл в другую ячейку тела. */
  hover?: BodyEventHandler<MouseEvent>
  copy?: BodyEventHandler<ClipboardEvent>
  contextmenu?: BodyEventHandler<MouseEvent>
}

export interface RootContributionContext {
  table: Table<any, any>
  navigation: boolean
  state: Record<string, unknown>
}

export interface RootHookProps {
  table: Table<any, any>
  getScrollElement: () => HTMLElement | null
}

/** Вклад в корень грида. */
export interface RootContribution {
  id: string
  /** Атрибуты корня темы: от них зависят токены темы (ADR 0018). */
  themeAttrs?: () => ContributionOutput['attrs']
  /** Атрибуты элемента таблицы по состоянию: корень перерисовывают срезы раскладки. */
  attrs?: (context: RootContributionContext) => ContributionOutput['attrs']
  /** Хук на гриде с элементом прокрутки: автопрокрутка, копирование, поповер. */
  useRoot?: (props: RootHookProps) => ReactNode | void
  events?: BodyEvents
}

/** Клавиша навигации в канале клавиш. */
export interface NavigationKeyEvent {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

export interface NavigationKeyContext {
  table: Table<any, any>
  active: { rowIndex: number; columnIndex: number }
  /** Строк на экран тела: шаг `PageUp` и `PageDown`. */
  pageRows: number
}

/** Вклад в клавиши навигации (ADR 0170, §4). */
export interface NavigationKeys {
  id: string
  /** Клавиша до хода активной ячейки; `true` — плагин её взял. */
  onKey?: (event: NavigationKeyEvent, context: NavigationKeyContext) => boolean
  /** Активная ячейка сменилась с клавиатуры. */
  onActiveCellChange?: (
    table: Table<any, any>,
    next: { rowIndex: number; columnIndex: number },
  ) => void
}

export interface WindowContext {
  table: Table<any, any>
  /** Строки модели, если список загружен целиком; у серверной модели — пусто. */
  rows: readonly Row<any, any>[]
  rowSource: RowSource
  rowCount: number
  drop: DropPreview | null
}

export interface WindowRowContext {
  /** Окно виртуализатора строк. */
  first: number
  last: number
  /** Строка — перетаскиваемая. */
  active: boolean
}

/**
 * Данные строк окна (ADR 0170, §3): считаются раз на смену модели строк, источника и
 * превью броска; значение строки получают вклады строки и ячейки.
 */
export interface WindowContribution<TData = any> {
  id: string
  compute: (context: WindowContext) => TData
  row: (data: TData, index: number, context: WindowRowContext) => unknown
  /** Место в дереве скелет-строки на месте незагруженной строки (ADR 0161, §2). */
  skeleton?: (
    data: TData,
    index: number,
    context: WindowRowContext,
  ) => SkeletonTreePlace | undefined
}

/** Вклад записи плагина в тело грида. */
export interface BodyContributions {
  cell?: CellContribution
  row?: RowContribution
  root?: RootContribution
  keys?: NavigationKeys
  window?: WindowContribution
}

export interface FoldedBody {
  cell: CellContribution[]
  row: RowContribution[]
  root: RootContribution[]
  keys: NavigationKeys[]
  window: WindowContribution[]
}

export const createEmptyBody = (): FoldedBody => ({
  cell: [],
  row: [],
  root: [],
  keys: [],
  window: [],
})

const EMPTY_BODY = createEmptyBody()

/** Добавить вклад записи; повторный `id` заменяет прежний на его месте. */
export const registerBodyInto = (
  folded: FoldedBody,
  body: BodyContributions | undefined,
) => {
  for (const key of Object.keys(body ?? {}) as (keyof BodyContributions)[]) {
    const item = body?.[key]
    if (!item) continue
    const list = folded[key] as { id: string }[]
    const index = list.findIndex(other => other.id === item.id)
    if (index === -1) list.push(item)
    else list[index] = item
  }
}

/** Фабрика плагина с вкладом в тело в записи. */
export const withBody =
  <TOptions, TEntry extends object>(
    factory: (opts?: TOptions) => TEntry,
    body: BodyContributions,
  ) =>
  (opts?: TOptions): TEntry => ({ ...factory(opts), body })

export const bodyOf = (table: unknown): FoldedBody =>
  (table as { options?: { pluginBody?: FoldedBody } }).options?.pluginBody ??
  EMPTY_BODY

/** Сравнение по полям до глубины `depth`: выбор вкладчика бывает объектом. */
const equalTo = (a: unknown, b: unknown, depth: number): boolean => {
  if (Object.is(a, b)) return true
  if (depth === 0 || typeof a !== 'object' || !a || typeof b !== 'object' || !b)
    return false
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  return aKeys.every(key =>
    equalTo(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      depth - 1,
    ),
  )
}

/** Узел цели → список выборов вкладчиков → выбор → его поля. */
const nodeEqual = (a: unknown, b: unknown) => equalTo(a, b, 3)

/**
 * Одна подписка цели на store: выбор ядра и выборы вкладчиков одним узлом. Выборы
 * вкладчиков — под ключом `contributions`.
 */
export const useContributionNode = <TCore extends object, TContext>(
  table: unknown,
  contributions: readonly TargetContribution<TContext>[],
  context: TContext,
  selectCore: (state: Record<string, unknown>) => TCore,
): TCore & { contributions: unknown[] } => {
  const store = (table as { store: Parameters<typeof useSelector>[0] }).store
  return useSelector(
    store,
    (state: unknown) => {
      const s = state as Record<string, unknown>
      const core = selectCore(s)
      return {
        ...core,
        contributions: contributions.map(item => item.select(s, context)),
      }
    },
    { compare: nodeEqual },
  ) as TCore & { contributions: unknown[] }
}

export interface MergedContribution {
  attrs: Record<string, string | number | boolean | undefined>
  style?: CSSProperties
  tabIndex?: number
}

/** Вклады цели одним набором: атрибуты и стиль сливаются, `tabIndex` — первый заданный. */
export const mergeContributions = <TContext>(
  contributions: readonly TargetContribution<TContext>[],
  selected: readonly unknown[],
  context: TContext,
): MergedContribution => {
  const merged: MergedContribution = { attrs: {} }
  contributions.forEach((item, index) => {
    const output = item.render(selected[index], context)
    if (!output) return
    if (output.attrs) Object.assign(merged.attrs, output.attrs)
    if (output.style) merged.style = { ...merged.style, ...output.style }
    if (merged.tabIndex === undefined) merged.tabIndex = output.tabIndex
  })
  return merged
}

/** Атрибуты элемента таблицы от вкладчиков корня; без них — пусто. */
export const rootAttrsOf = (
  context: Omit<RootContributionContext, 'state'>,
) => {
  const attrs: NonNullable<ContributionOutput['attrs']> = {}
  const roots = bodyOf(context.table).root
  if (!roots.length) return attrs
  const state = context.table.store.get() as unknown as Record<string, unknown>
  for (const item of roots) {
    Object.assign(attrs, item.attrs?.({ ...context, state }))
  }
  return attrs
}

/** Атрибуты корня темы от вкладчиков корня. */
export const themeAttrsOf = (table: unknown) => {
  const attrs: NonNullable<ContributionOutput['attrs']> = {}
  for (const item of bodyOf(table).root)
    Object.assign(attrs, item.themeAttrs?.())
  return attrs
}

/** Слои ячейки от вкладчиков: узлы перед содержимым и их атрибуты. */
export const cellLayersOf = (context: CellLayerContext) => {
  const nodes: ReactNode[] = []
  const attrs: NonNullable<ContributionOutput['attrs']> = {}
  for (const item of bodyOf(context.table).cell) {
    const layer = item.layer?.(context)
    if (!layer) continue
    if (layer.node != null) {
      nodes.push(createElement(Fragment, { key: item.id }, layer.node))
    }
    Object.assign(attrs, layer.attrs)
  }
  return { nodes, attrs }
}

export interface WindowData {
  /** Данные строки окна; без вкладчиков — `undefined`. */
  rowOf: (index: number, active?: boolean) => WindowRow | undefined
  /** Место скелет-строки в дереве от первого вкладчика, который его знает. */
  skeletonOf: (index: number) => SkeletonTreePlace | undefined
}

/**
 * Данные строк окна вкладчиков: `compute` — раз на смену строк, источника, их числа и
 * превью броска; значение строки, совпавшее по полям с прошлым, отдаётся тем же
 * объектом — строки и ячейки под memo не перерисовываются.
 */
export const useWindowData = (
  context: WindowContext,
  window: { first: number; last: number },
): WindowData => {
  const { table, rows, rowSource, rowCount, drop } = context
  const contributors = bodyOf(table).window
  const computed = useMemo(
    () =>
      contributors.map(item =>
        item.compute({ table, rows, rowSource, rowCount, drop }),
      ),
    // `table` — новая копия на каждый рендер; данные от неё не зависят.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contributors, rows, rowSource, rowCount, drop],
  )
  if (!contributors.length) return NO_WINDOW
  const { first, last } = window
  const previous = windowRowsOf(table, first, last)
  const rowOf = (index: number, active = false) => {
    const next: Record<string, unknown> = {}
    contributors.forEach((item, at) => {
      next[item.id] = item.row(computed[at], index, { first, last, active })
    })
    const key = `${index}:${active}`
    const before = previous.get(key)
    if (before && equalTo(before, next, 2)) return before
    previous.set(key, next)
    return next
  }
  const skeletonOf = (index: number) => {
    for (const [at, item] of contributors.entries()) {
      const place = item.skeleton?.(computed[at], index, {
        first,
        last,
        active: false,
      })
      if (place) return place
    }
    return undefined
  }
  return { rowOf, skeletonOf }
}

/** Прошлые значения строк окна по таблице: живут, пока строка рядом с окном. */
const windowRows = new WeakMap<object, Map<string, WindowRow>>()
const WINDOW_ROWS_LIMIT = 2000

const windowRowsOf = (table: unknown, first: number, last: number) => {
  const store = (table as { store: object }).store
  let rows = windowRows.get(store)
  if (!rows) windowRows.set(store, (rows = new Map()))
  if (rows.size > WINDOW_ROWS_LIMIT) {
    for (const key of rows.keys()) {
      const index = Number.parseInt(key, 10)
      if (index < first - 50 || index > last + 50) rows.delete(key)
    }
  }
  return rows
}

const NO_WINDOW: WindowData = {
  rowOf: () => undefined,
  skeletonOf: () => undefined,
}

const RootHook = ({
  use,
  ...props
}: RootHookProps & { use: NonNullable<RootContribution['useRoot']> }) => {
  return use(props) ?? null
}

/** Хуки вкладчиков корня — компонентом на вкладчика: набор плагинов может смениться. */
export const RootHooks = (props: RootHookProps): ReactNode =>
  createElement(
    Fragment,
    null,
    ...bodyOf(props.table).root.flatMap(item =>
      item.useRoot
        ? [
            createElement(RootHook, {
              key: item.id,
              use: item.useRoot,
              ...props,
            }),
          ]
        : [],
    ),
  )

const BODY_ROW = '.data-grid__body-row[data-row-id]'
const BODY_CELL = '.data-grid__body-cell[data-column-id]'

/** Строка и ячейка тела под элементом события. */
export const bodyTargetOf = (
  table: Table<any, any>,
  element: EventTarget | null,
): BodyEventTarget | undefined => {
  const node = element as HTMLElement | null
  const rowElement = node?.closest?.<HTMLElement>(BODY_ROW) ?? undefined
  const cellElement = node?.closest?.<HTMLElement>(BODY_CELL) ?? undefined
  if (!rowElement && !cellElement) return undefined
  const rowId = rowElement?.dataset.rowId
  const row =
    rowId === undefined
      ? undefined
      : ((table.getRowSource().byId(rowId) as Row<any, any> | undefined) ??
        undefined)
  const columnId = cellElement?.dataset.columnId
  const cell =
    row && columnId !== undefined
      ? row.getAllCellsByColumnId()[columnId]
      : undefined
  return { table, row, cell, rowElement, cellElement }
}

const lastHovered = new WeakMap<object, HTMLElement>()

/**
 * Обработчики корня грида: события над телом — вкладчикам со строкой и ячейкой события.
 * Без вкладчиков события `undefined` — у корня нет обработчиков.
 */
export const bodyEventHandlers = (table: Table<any, any>) => {
  const roots = bodyOf(table).root
  const dispatch = <E extends Event>(name: keyof BodyEvents) => {
    const handlers = roots.flatMap(item => {
      const handler = item.events?.[name] as BodyEventHandler<E> | undefined
      return handler ? [handler] : []
    })
    if (!handlers.length) return undefined
    return (event: { nativeEvent: E; target: EventTarget }) => {
      const target = bodyTargetOf(table, event.target)
      if (!target) return
      if (name === 'hover') {
        const store = table.store as object
        if (
          !target.cellElement ||
          lastHovered.get(store) === target.cellElement
        )
          return
        lastHovered.set(store, target.cellElement)
      }
      for (const handler of handlers) handler(event.nativeEvent, target)
    }
  }
  return {
    onMouseDown: dispatch<MouseEvent>('mousedown'),
    onMouseOver: dispatch<MouseEvent>('hover'),
    onCopy: dispatch<ClipboardEvent>('copy'),
    onContextMenu: dispatch<MouseEvent>('contextmenu'),
  }
}

/** Клавиша навигации — вкладчикам до хода активной ячейки; `true` — её взяли. */
export const runNavigationKeys = (
  table: Table<any, any>,
  event: NavigationKeyEvent,
  context: Omit<NavigationKeyContext, 'table'>,
): boolean =>
  bodyOf(table).keys.some(
    item => item.onKey?.(event, { table, ...context }) === true,
  )

/** Сменилась активная ячейка с клавиатуры — вкладчикам клавиш. */
export const notifyActiveCellChange = (
  table: Table<any, any>,
  next: { rowIndex: number; columnIndex: number },
) => {
  for (const item of bodyOf(table).keys) item.onActiveCellChange?.(table, next)
}
