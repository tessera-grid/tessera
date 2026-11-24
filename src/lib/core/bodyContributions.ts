/**
 * Канал вклада плагинов в тело грида (ADR 0170, §3–§4): что плагин вносит в ячейку и
 * строку тела, в корень грида и в клавиши навигации. Авторам открыта часть канала — поле
 * `body` у `definePlugin` (ADR 0173): своё пространство имён, изоляция ошибок, dev-замер.
 */
import {
  createElement,
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from 'react'

import { useSelector } from '@tanstack/react-store'

import type { DropPreview } from './dragSession'
import type { KeyboardShortcutDefinition } from './keyboardShortcut'
import {
  type RenderVersionAtom,
  usePluginRenderVersionAtom,
} from './renderVersion'
import { PluginErrorBoundary } from './pluginBoundary'
import { reportPluginError } from './pluginDiagnostics'
import { isProduction, logError, logWarn } from '../util/logger'
import { useLatest } from '../util/useLatest'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'
import { pluginStateKey } from './definePlugin/channels'
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
  /** Вклад плагина автора (ADR 0173): уже занятые атрибуты он не перезаписывает. */
  author?: true
  /**
   * Ключи состояния таблицы, которые читает выбор — прямо или через методы строки и ячейки;
   * узел цели подписан только на них (ADR 0195).
   */
  slices: readonly string[]
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
  /**
   * Значение смонтированной ячейки сменилось (ADR 0221, §4): зовётся после коммита с новым и
   * прежним значением; первая отрисовка ячейки — не смена.
   */
  watch?: (
    cell: Cell<any, any, unknown>,
    value: unknown,
    previous: unknown,
  ) => void
}

/**
 * Сторож значения ячейки для вкладчиков с `watch` (ADR 0221, §4): без них значение не
 * читается. Эффект идёт при смене ячейки — новой строки, — а не на каждую отрисовку.
 */
export const useCellValueWatch = (
  contributors: readonly CellContribution[],
  cell: Cell<any, any, unknown>,
) => {
  const watching = contributors.some(contributor => contributor.watch)
  const value = watching ? cell.getValue() : undefined
  const last = useRef({ value, watching })
  useIsomorphicLayoutEffect(() => {
    const previous = last.current
    last.current = { value, watching }
    if (!watching || !previous.watching || Object.is(previous.value, value)) {
      return
    }
    for (const contributor of contributors) {
      contributor.watch?.(cell, value, previous.value)
    }
  }, [contributors, cell, value, watching])
}
/** Ячейка заголовка, в которой вклад рисует слой (ADR 0218, §10). */
export interface HeadCellContext {
  table: Table<any, any>
  columnId: string
}

/** Вклад в ячейку заголовка: атрибуты, переменные стиля и слой перед содержимым. */
export interface HeadCellContribution {
  id: string
  render: (context: HeadCellContext) => (CellLayer & ContributionOutput) | null
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
  click?: BodyEventHandler<MouseEvent>
  dblclick?: BodyEventHandler<MouseEvent>
  /** Указатель вошёл в другую ячейку тела. */
  hover?: BodyEventHandler<MouseEvent>
  copy?: BodyEventHandler<ClipboardEvent>
  /** Вставка и вырезание над телом (ADR 0219). */
  paste?: BodyEventHandler<ClipboardEvent>
  cut?: BodyEventHandler<ClipboardEvent>
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
  /** Вклад плагина автора (ADR 0173): атрибуты — под атрибутами грида, хук — в границе. */
  author?: true
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
  /** Код клавиши: сочетания с буквой — по нему, на любой раскладке. */
  code: string
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
  /** Сочетания для сводки клавиш (ADR 0232, KX18). */
  shortcuts?: readonly KeyboardShortcutDefinition[]
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
  /** Ячейка заголовка — только у встроенных плагинов. */
  head?: HeadCellContribution
  row?: RowContribution
  root?: RootContribution
  keys?: NavigationKeys
  window?: WindowContribution
}

export interface FoldedBody {
  cell: CellContribution[]
  head: HeadCellContribution[]
  row: RowContribution[]
  root: RootContribution[]
  keys: NavigationKeys[]
  window: WindowContribution[]
}

export const createEmptyBody = (): FoldedBody => ({
  cell: [],
  head: [],
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

interface Readable<T> {
  get: () => T
  subscribe: (listener: () => void) => { unsubscribe: () => void }
}

interface NodeSnapshot {
  state: Record<string, unknown>
  version: number
  /** Значения атомов подписанных срезов при снимке. */
  values?: readonly unknown[]
}

interface SliceAtom {
  get: () => unknown
  subscribe: (listener: () => void) => { unsubscribe: () => void }
}

const sliceSources = new WeakMap<
  object,
  WeakMap<RenderVersionAtom, Map<string, Readable<NodeSnapshot>>>
>()

/**
 * Атомы срезов `slices` и версия отрисовки одним источником (ADR 0195, §1): снимок — новый,
 * только когда сменилось значение одного из этих атомов или версия; смена прочих срезов
 * подписчиков не будит.
 */
const sliceSourceOf = (
  table: { store: Readable<Record<string, unknown>>; atoms: object },
  version: RenderVersionAtom,
  slices: readonly string[],
): Readable<NodeSnapshot> => {
  const key = slices.join('\u0000')
  let byVersion = sliceSources.get(table.store)
  if (!byVersion) {
    byVersion = new WeakMap()
    sliceSources.set(table.store, byVersion)
  }
  let byKey = byVersion.get(version)
  if (!byKey) {
    byKey = new Map()
    byVersion.set(version, byKey)
  }
  let source = byKey.get(key)
  if (!source) {
    const atoms = table.atoms as Record<string, SliceAtom | undefined>
    const watched = slices
      .map(slice => atoms[slice])
      .filter((atom): atom is SliceAtom => !!atom)
    let last: NodeSnapshot | undefined
    const listeners = new Set<() => void>()
    const notify = () => listeners.forEach(listener => listener())
    let subscriptions: { unsubscribe: () => void }[] | undefined
    source = {
      get: () => {
        const current = version.get()
        if (
          !last ||
          last.version !== current ||
          watched.some((atom, i) => !Object.is(atom.get(), last!.values![i]))
        ) {
          last = {
            state: table.store.get(),
            version: current,
            values: watched.map(atom => atom.get()),
          }
        }
        return last
      },
      subscribe: listener => {
        listeners.add(listener)
        subscriptions ??= [
          ...watched.map(atom => atom.subscribe(notify)),
          version.subscribe(notify),
        ]
        return {
          unsubscribe: () => {
            listeners.delete(listener)
            if (listeners.size > 0 || !subscriptions) return
            for (const subscription of subscriptions) subscription.unsubscribe()
            subscriptions = undefined
          },
        }
      },
    }
    byKey.set(key, source)
  }
  return source
}

/**
 * Dev-проверка необъявленных срезов (ADR 0195, §3): на смену срезов вне подписки узла выборы
 * вкладчиков пересчитываются; итог сменился — предупреждение, одно на вкладчика и срезы.
 */
const useUndeclaredSliceCheck = <TContext>(
  table: unknown,
  store: Readable<Record<string, unknown>>,
  latest: {
    current: {
      contributions: readonly TargetContribution<TContext>[]
      context: TContext
      selected: readonly unknown[]
      slices: readonly string[]
    }
  },
) => {
  useEffect(() => {
    if (isProduction()) return
    let before = store.get()
    const subscription = store.subscribe(() => {
      const next = store.get()
      const previous = before
      before = next
      const { contributions, context, selected, slices } = latest.current
      if (!contributions.length) return
      // Срез подписки сменился — узел пересчитал выборы сам.
      if (slices.some(slice => previous[slice] !== next[slice])) return
      const changed = Object.keys(next).filter(
        key => previous[key] !== next[key],
      )
      if (!changed.length) return
      contributions.forEach((item, index) => {
        if (nodeEqual(item.select(next, context), selected[index])) return
        const keys = changed.join(', ')
        logWarn(
          table as never,
          `${item.id}: body select reads ${keys}, which is not in its slices — the target does not update on this change (ADR 0195)`,
          `body-slices:${item.id}:${keys}`,
        )
      })
    })
    return () => subscription.unsubscribe()
  }, [table, store, latest])
}

/**
 * Одна подписка цели на атомы своих срезов и версию отрисовки (ADR 0195): выбор ядра и
 * выборы вкладчиков одним узлом. Выборы вкладчиков — под ключом `contributions`.
 */
export const useContributionNode = <TCore extends object, TContext>(
  table: unknown,
  contributions: readonly TargetContribution<TContext>[],
  context: TContext,
  coreSlices: readonly string[],
  selectCore: (state: Record<string, unknown>) => TCore,
): TCore & { contributions: unknown[] } => {
  const t = table as {
    store: Readable<Record<string, unknown>>
    atoms: object
  }
  const slices = [
    ...new Set([...coreSlices, ...contributions.flatMap(item => item.slices)]),
  ]
  const source = sliceSourceOf(t, usePluginRenderVersionAtom(), slices)
  const node = useSelector(
    source as never,
    (snapshot: NodeSnapshot) => {
      const s = snapshot.state
      const core = selectCore(s)
      return {
        ...core,
        contributions: contributions.map(item => item.select(s, context)),
      }
    },
    { compare: nodeEqual },
  ) as TCore & { contributions: unknown[] }
  const latest = useLatest({
    contributions,
    context,
    selected: node.contributions,
    slices,
  })
  useUndeclaredSliceCheck(table, t.store, latest)
  return node
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
    if (output.attrs && item.author) {
      for (const [key, value] of Object.entries(output.attrs)) {
        if (!(key in merged.attrs)) merged.attrs[key] = value
      }
    } else if (output.attrs) Object.assign(merged.attrs, output.attrs)
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
    if (!item.author) Object.assign(attrs, item.attrs?.({ ...context, state }))
  }
  return attrs
}

/** Атрибуты элемента таблицы от плагинов авторов: грид кладёт свои поверх (ADR 0173). */
export const authorRootAttrsOf = (
  context: Omit<RootContributionContext, 'state'>,
) => {
  const attrs: NonNullable<ContributionOutput['attrs']> = {}
  const roots = bodyOf(context.table).root
  if (!roots.some(item => item.author)) return attrs
  const state = context.table.store.get() as unknown as Record<string, unknown>
  for (const item of roots) {
    if (item.author) Object.assign(attrs, item.attrs?.({ ...context, state }))
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

/** Вклады в ячейку заголовка: узлы перед содержимым, атрибуты и переменные стиля. */
export const headLayersOf = (context: HeadCellContext) => {
  const nodes: ReactNode[] = []
  const attrs: NonNullable<ContributionOutput['attrs']> = {}
  const style: NonNullable<ContributionOutput['style']> = {}
  for (const item of bodyOf(context.table).head) {
    const layer = item.render(context)
    if (!layer) continue
    if (layer.node != null) {
      nodes.push(createElement(Fragment, { key: item.id }, layer.node))
    }
    Object.assign(attrs, layer.attrs)
    Object.assign(style, layer.style)
  }
  return { nodes, attrs, style }
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

/**
 * Хуки вкладчиков корня — компонентом на вкладчика: набор плагинов может смениться. Хук
 * плагина автора — в границе ошибок; выключенный вклад автора не монтируется.
 */
export const RootHooks = (props: RootHookProps): ReactNode =>
  createElement(
    Fragment,
    null,
    ...bodyOf(props.table).root.flatMap((item): ReactNode[] => {
      if (!item.useRoot) return []
      const hook = createElement(RootHook, {
        key: item.id,
        use: item.useRoot,
        ...props,
      })
      if (!item.author) return [hook]
      if (isBodyDisabled(props.table, item.id)) return []
      return [
        createElement(
          PluginErrorBoundary,
          { key: item.id, pluginId: item.id, table: props.table },
          hook,
        ),
      ]
    }),
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
    onClick: dispatch<MouseEvent>('click'),
    onDoubleClick: dispatch<MouseEvent>('dblclick'),
    onMouseOver: dispatch<MouseEvent>('hover'),
    onCopy: dispatch<ClipboardEvent>('copy'),
    onPaste: dispatch<ClipboardEvent>('paste'),
    onCut: dispatch<ClipboardEvent>('cut'),
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

// --- Канал для авторов плагинов (ADR 0173) --------------------------------------------

/** Вклад автора в ячейку или строку: атрибуты `data-<id>-*` и `aria-*`, переменные `--<id>-*`. */
export interface PluginBodyOutput {
  attrs?: Record<string, string | number | boolean | undefined>
  style?: Record<string, string>
}

/** Ячейка тела для вклада автора. */
export interface PluginCellContext {
  table: Table<any, any>
  cell: Cell<any, any, unknown>
  rowIndex: number
  /** Клавиатурная навигация включена у грида. */
  navigation: boolean
}

/** Строка тела для вклада автора. */
export interface PluginRowContext {
  table: Table<any, any>
  row: Row<any, any>
  rowIndex: number
  navigation: boolean
}

/**
 * Вклад автора в цель тела: выбор из состояния таблицы и вклад по нему. Цель
 * перерисовывается, только когда выбор изменился.
 */
export interface PluginTargetBody<TContext, TSelected = any> {
  /**
   * Ключи состояния таблицы, которые читает `select` — прямо или через методы строки и
   * ячейки; цель перерисовывается только на их смену. Свой срез плагина входит сам (ADR 0195).
   */
  slices: readonly string[]
  select: (state: Record<string, unknown>, context: TContext) => TSelected
  render: (selected: TSelected, context: TContext) => PluginBodyOutput | null
}

/** События над телом, строка и ячейка события, корень и клавиши — для вклада автора. */
export type PluginBodyEvents = BodyEvents
export type PluginBodyEventTarget = BodyEventTarget
export type PluginRootContext = RootContributionContext
export type PluginRootHookProps = RootHookProps
export type PluginKeyEvent = NavigationKeyEvent
export type PluginKeyContext = NavigationKeyContext

/** Вклад автора в корень грида: атрибуты таблицы, события над телом, хук. */
export interface PluginRootBody {
  attrs?: (context: RootContributionContext) => PluginBodyOutput['attrs']
  events?: BodyEvents
  useRoot?: (props: RootHookProps) => ReactNode | void
}

/** Вклад автора в клавиши навигации. */
export type PluginKeysBody = Omit<NavigationKeys, 'id'>

/** Поле `body` записи `definePlugin` (ADR 0173). */
export interface PluginBody {
  cell?: PluginTargetBody<PluginCellContext>
  row?: PluginTargetBody<PluginRowContext>
  root?: PluginRootBody
  keys?: PluginKeysBody
}

/** Выключенные вклады авторов: на таблицу (её store) — id плагинов. */
const disabledBodies = new WeakMap<object, Set<string>>()

const storeOf = (table: unknown) => (table as { store: object }).store

export const isBodyDisabled = (table: unknown, pluginId: string) =>
  disabledBodies.get(storeOf(table))?.has(pluginId) ?? false

const disableBody = (table: unknown, pluginId: string, error: unknown) => {
  const store = storeOf(table)
  let ids = disabledBodies.get(store)
  if (!ids) disabledBodies.set(store, (ids = new Set()))
  ids.add(pluginId)
  reportPluginError(table, pluginId, error)
}

/** Средний вызов выбора, после которого в dev — предупреждение, мс (BC5). */
const SLOW_SELECT_MS = 0.05
/** Вызовов выбора до суждения о среднем. */
const SLOW_SELECT_CALLS = 500
/** Сколько первых вызовов выбор зовётся дважды: новый объект при том же состоянии. */
const SAME_STATE_CHECKS = 50

const OFF = Symbol('body-off')

/**
 * Вклад автора как запись канала: имена вне пространства плагина пропускаются с одним
 * dev-предупреждением на ключ, исключение выключает вклад (`status: 'error'`), в dev —
 * замер выбора.
 */
export const authorBodyOf = (
  pluginId: string,
  body: PluginBody,
): BodyContributions => {
  const allowed = new Map<string, boolean>()
  // Имена атрибутов HTML регистр не различает, переменные стиля — различают.
  const dataPrefix = `data-${pluginId.toLowerCase()}-`
  const inNamespace = (table: unknown, key: string, style: boolean) => {
    let ok = allowed.get(key)
    if (ok === undefined) {
      const lower = key.toLowerCase()
      ok = style
        ? key.startsWith(`--${pluginId}-`)
        : lower.startsWith(dataPrefix) || lower.startsWith('aria-')
      allowed.set(key, ok)
    }
    if (!ok) {
      logWarn(
        table as never,
        `${pluginId}: body ${style ? 'style variable' : 'attribute'} "${key}" is outside the plugin namespace (data-${pluginId}-*, aria-*, --${pluginId}-*) and is skipped`,
        `body-name:${pluginId}:${key}`,
      )
    }
    return ok
  }
  const filterAttrs = (table: unknown, attrs: PluginBodyOutput['attrs']) => {
    if (!attrs) return undefined
    const out: NonNullable<PluginBodyOutput['attrs']> = {}
    for (const [key, value] of Object.entries(attrs)) {
      if (inNamespace(table, key, false)) out[key] = value
    }
    return out
  }
  const filterOutput = (
    table: unknown,
    output: PluginBodyOutput | null,
  ): ContributionOutput | null => {
    if (!output) return null
    let style: Record<string, string> | undefined
    for (const [key, value] of Object.entries(output.style ?? {})) {
      if (inNamespace(table, key, true)) (style ??= {})[key] = value
    }
    return { attrs: filterAttrs(table, output.attrs), style }
  }

  let calls = 0
  let spent = 0
  const measured = <TContext extends { table: unknown }>(
    select: PluginTargetBody<TContext>['select'],
  ) => {
    if (isProduction()) return select
    return (state: Record<string, unknown>, context: TContext) => {
      const start = performance.now()
      const selected = select(state, context)
      spent += performance.now() - start
      calls += 1
      if (
        calls <= SAME_STATE_CHECKS &&
        typeof selected === 'object' &&
        selected
      ) {
        if (select(state, context) !== selected) {
          logWarn(
            context.table as never,
            `${pluginId}: body select returns a new object for the same state — return a primitive or a stable object`,
            `body-select-new:${pluginId}`,
          )
        }
      }
      if (calls === SLOW_SELECT_CALLS && spent / calls > SLOW_SELECT_MS) {
        logWarn(
          context.table as never,
          `${pluginId}: body select takes ${(spent / calls).toFixed(3)} ms per call on average — keep it under ${SLOW_SELECT_MS} ms`,
          `body-select-slow:${pluginId}`,
        )
      }
      return selected
    }
  }

  const target = <TContext extends { table: unknown }>(
    part: PluginTargetBody<TContext>,
  ): TargetContribution<TContext> => {
    const select = measured(part.select)
    if (!Array.isArray(part.slices)) {
      logError(
        {},
        `${pluginId}: body.cell and body.row need slices — the state keys their select reads (ADR 0195)`,
        `body-no-slices:${pluginId}`,
      )
    }
    return {
      id: pluginId,
      author: true,
      slices: [...(part.slices ?? []), pluginStateKey(pluginId)],
      select: (state, context) => {
        if (isBodyDisabled(context.table, pluginId)) return OFF
        try {
          return select(state, context)
        } catch (error) {
          disableBody(context.table, pluginId, error)
          return OFF
        }
      },
      render: (selected, context) => {
        if (selected === OFF || isBodyDisabled(context.table, pluginId))
          return null
        try {
          return filterOutput(context.table, part.render(selected, context))
        } catch (error) {
          disableBody(context.table, pluginId, error)
          return null
        }
      },
    }
  }

  /** Обработчик автора: исключение выключает вклад, выключенный — не зовётся. */
  const guarded =
    <TArgs extends unknown[], TResult>(
      tableOf: (...args: TArgs) => unknown,
      fn: (...args: TArgs) => TResult,
      fallback: TResult,
    ) =>
    (...args: TArgs): TResult => {
      const table = tableOf(...args)
      if (isBodyDisabled(table, pluginId)) return fallback
      try {
        return fn(...args)
      } catch (error) {
        disableBody(table, pluginId, error)
        return fallback
      }
    }

  const out: BodyContributions = {}
  if (body.cell) out.cell = target(body.cell) as CellContribution
  if (body.row) out.row = target(body.row) as RowContribution
  if (body.root) {
    const { attrs, events, useRoot } = body.root
    out.root = {
      id: pluginId,
      author: true,
      ...(attrs && {
        attrs: guarded(
          context => context.table,
          context => filterAttrs(context.table, attrs(context)),
          undefined,
        ),
      }),
      ...(events && {
        events: Object.fromEntries(
          Object.entries(events).map(([name, handler]) => [
            name,
            guarded(
              (_event: Event, target: BodyEventTarget) => target.table,
              handler as (event: Event, target: BodyEventTarget) => void,
              undefined,
            ),
          ]),
        ) as BodyEvents,
      }),
      ...(useRoot && { useRoot }),
    }
  }
  if (body.keys) {
    const { onKey, onActiveCellChange } = body.keys
    out.keys = {
      id: pluginId,
      ...(onKey && {
        onKey: guarded((_event, context) => context.table, onKey, false),
      }),
      ...(onActiveCellChange && {
        onActiveCellChange: guarded(
          table => table,
          onActiveCellChange,
          undefined,
        ),
      }),
    }
  }
  return out
}
