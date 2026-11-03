/**
 * Прокрутка к строке (ADR 0104): `table.scrollToRow(rowId, options)`. Ядровая фича,
 * всегда включена: API доступно приложению и плагинам. Строка вне текущей модели —
 * переключение страницы и, по опции, раскрытие предков; затем один прыжок по замерам
 * виртуализатора и геометрии липких шапки, футера и закреплённых колонок, проверка и
 * довод по DOM.
 */
import { reportAction } from '../debugActions'
import { assignTableAPIs } from '@tanstack/react-table'

import { getDisplayColumns } from '../displayColumns'
import {
  getBodyViewport,
  getCenterViewport,
} from '../keyboardNavigation/geometry'
import type { Row, RowData, TableFeature, TableFeatures } from '../../types'
import { dataModeOf, isPaginationActive } from '../dataMode'
import type { RowSource } from '../rowSource'
import { type ScrollTarget, scrollGridTo } from '../scrollGridTo'
import { scrollLayer } from '../scrollStretch'
import { type ScrollViewport, viewportOf } from './viewport'

export type ScrollAlign = 'auto' | 'start' | 'center' | 'end'

export interface ScrollToRowOptions {
  /** Куда поставить строку; `auto` не двигает видимую. По умолчанию `auto`. */
  align?: ScrollAlign
  /** `instant` — прыжок за кадр (по умолчанию), `smooth` — плавно. */
  behavior?: 'instant' | 'smooth'
  /** Ещё и горизонталь к колонке. */
  columnId?: string
  /** Раскрыть свёрнутых предков строки. */
  expandParents?: boolean
  /**
   * Индекс строки в списке, если она ещё не загружена (серверная модель строк, ADR 0138,
   * §12): прокрутка к нему, затем строка с этим id должна там оказаться.
   */
  index?: number
}

export type ScrollToRowIndexOptions = Omit<
  ScrollToRowOptions,
  'expandParents' | 'index'
>

interface ScrollToRowTableAPI {
  /**
   * Прокрутить грид к строке (ADR 0104). `true` — строка смонтирована и стоит на
   * месте; `false` — показать нельзя (отфильтрована, не загружена, свёрнута без
   * `expandParents`, грид не смонтирован) или вызов перебит новым.
   */
  scrollToRow: (rowId: string, options?: ScrollToRowOptions) => Promise<boolean>
  /**
   * Прокрутить грид к строке по индексу в списке и дождаться её загрузки (ADR 0138,
   * §12). `false` — индекса нет в списке, блок строки отказал или вызов перебит.
   */
  scrollToRowIndex: (
    index: number,
    options?: ScrollToRowIndexOptions,
  ) => Promise<boolean>
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    scrollToRowFeature: TableFeature
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    scrollToRowFeature: ScrollToRowTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

type AnyRow = Row<any, any>

interface ScrollTable {
  store: { state: { pagination?: { pageIndex: number; pageSize: number } } }
  getRowSource: () => RowSource<AnyRow>
  getPreExpandedRowModel: () => { rows: AnyRow[] }
  setPageIndex?: (index: number) => void
  setExpanded?: (
    updater: (
      old: true | Record<string, boolean>,
    ) => true | Record<string, boolean>,
  ) => void
  getColumn: (
    id: string,
  ) =>
    | { getIsVisible: () => boolean; getIsPinned: () => false | string }
    | undefined
}

const ROW_SELECTOR = '.data-grid__body-row'
const BODY_SELECTOR = '.data-grid__body'
const HEAD_CELL_SELECTOR = '.data-grid__head-cell'
/** Кадров на приход строки в модель и окно и на плавную прокрутку. */
const WAIT_FRAMES = 120
const STABLE_FRAMES = 2

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

/** Ждать условия по кадрам; `false` — не дождались или вызов перебит. */
const until = async (check: () => boolean, alive: () => boolean) => {
  for (let i = 0; i < WAIT_FRAMES; i++) {
    if (!alive()) return false
    if (check()) return true
    await frame()
  }
  return false
}

/** Кадров, за которые плавная прокрутка должна сдвинуться, иначе её нет. */
const SMOOTH_START_FRAMES = 20

/**
 * Ждать, пока прокрутка не перестанет двигаться. Плавная начинается не в первом
 * кадре: до первого сдвига неподвижность — не конец.
 */
const settle = async (
  scroller: HTMLElement,
  alive: () => boolean,
  smooth = false,
) => {
  const layer = scrollLayer(scroller)
  let last = `${layer.top()}:${scroller.scrollLeft}`
  let stable = 0
  let moved = !smooth
  for (let i = 0; i < WAIT_FRAMES; i++) {
    await frame()
    if (!alive()) return
    const now = `${layer.top()}:${scroller.scrollLeft}`
    if (now === last) stable++
    else {
      stable = 0
      moved = true
    }
    last = now
    if (stable >= STABLE_FRAMES && (moved || i >= SMOOTH_START_FRAMES)) return
  }
}

const indexOf = (table: ScrollTable, rowId: string) =>
  table.getRowSource().indexOf(rowId)

/**
 * Путь от корня до строки в модели до раскрытия: отфильтрованной там нет. У серверной модели
 * строк — предки загруженной строки из источника (ADR 0138, SD53).
 */
const pathTo = (table: ScrollTable, rowId: string): AnyRow[] | undefined => {
  const source = table.getRowSource()
  if (source.ancestors) {
    const row = source.byId(rowId)
    if (!row) return undefined
    const path = source.ancestors(rowId).map(id => source.byId(id))
    return path.every(Boolean) ? [...(path as AnyRow[]), row] : undefined
  }
  const walk = (rows: AnyRow[], path: AnyRow[]): AnyRow[] | undefined => {
    for (const row of rows) {
      if (row.id === rowId) return [...path, row]
      if (row.subRows.length > 0) {
        const found = walk(row.subRows, [...path, row])
        if (found) return found
      }
    }
    return undefined
  }
  return walk(table.getPreExpandedRowModel().rows, [])
}

const paginationOf = (table: ScrollTable) => table.store.state.pagination

/** Страница строки: Tessera режет страницы по корням дерева (ADR 0038). */
const pageOf = (table: ScrollTable, root: AnyRow): number | undefined => {
  const pagination = paginationOf(table)
  if (
    !pagination ||
    !isPaginationActive(table) ||
    dataModeOf(table, 'pagination') === 'server' ||
    !table.setPageIndex
  ) {
    return undefined
  }
  const index = table.getPreExpandedRowModel().rows.indexOf(root)
  return index === -1 ? undefined : Math.floor(index / pagination.pageSize)
}

const cellSelector = (columnId: string) =>
  `[data-column-id="${CSS.escape(columnId)}"]`

const rowElement = (scroller: HTMLElement, rowId: string) =>
  scroller.querySelector<HTMLElement>(
    `${ROW_SELECTOR}[data-row-id="${CSS.escape(rowId)}"]`,
  )

/** Отрезок на экране по оси прокрутки: начало и конец. */
interface Span {
  start: number
  end: number
}

/** Сдвиг, чтобы отрезок встал по `align` в окне: `auto` не двигает видимый. */
const deltaFor = (span: Span, area: Span, align: ScrollAlign) => {
  const start = span.start - area.start
  const end = span.end - area.end
  if (align === 'start') return start
  if (align === 'end') return end
  if (align === 'center')
    return (span.start + span.end) / 2 - (area.start + area.end) / 2
  return start < 0 ? start : end > 0 ? end : 0
}

/**
 * Новое положение прокрутки по оси: сдвиг округлён в сторону полной видимости —
 * движок может держать прокрутку в целых пикселях (Firefox), и доля пикселя иначе
 * оставила бы строку под липкой шапкой или футером.
 */
const offsetFor = (
  current: number,
  span: Span,
  area: Span,
  align: ScrollAlign,
) => {
  const delta = deltaFor(span, area, align)
  if (delta === 0) return current
  const toStart = align === 'start' || (align === 'auto' && delta < 0)
  const toEnd = align === 'end' || (align === 'auto' && delta > 0)
  const value = current + delta
  return toStart
    ? Math.floor(value)
    : toEnd
      ? Math.ceil(value)
      : Math.round(value)
}

/**
 * Отрезок на месте: целиком в окне у своего края, у центра — с точностью до пикселя. У края
 * допуск — два пикселя: при дробном масштабе Firefox держит прокрутку на сетке шире пикселя,
 * и ровно к краю не встать.
 */
const isPlaced = (span: Span, area: Span, align: ScrollAlign) => {
  const delta = deltaFor(span, area, align)
  if (align === 'start') return delta >= 0 && delta < 2
  if (align === 'end') return delta <= 0 && delta > -2
  if (align === 'center') return Math.abs(delta) < 1
  return delta === 0
}

const vertical = (rect: DOMRect): Span => ({
  start: rect.top,
  end: rect.bottom,
})
const horizontal = (rect: DOMRect): Span => ({
  start: rect.left,
  end: rect.right,
})

/** Окно тела по вертикали: между липкими шапкой и футером. */
const bodyArea = (scroller: HTMLElement): Span => {
  const { top, bottom } = getBodyViewport(scroller)
  return { start: top, end: bottom }
}

/** Окно по горизонтали: между закреплёнными ячейками ряда ячейки `cell`. */
const centerArea = (cell: HTMLElement, scroller: HTMLElement): Span => {
  const { left, right } = getCenterViewport(cell, scroller)
  return { start: left, end: right }
}

/** Строка на экране по замерам виртуализатора — до того, как она смонтирована. */
const plannedRow = (
  viewport: ScrollViewport,
  scroller: HTMLElement,
  index: number,
): Span | undefined => {
  const body = scroller.querySelector<HTMLElement>(BODY_SELECTOR)
  const item = viewport.rows.measurementsCache[index]
  if (!body || !item) return undefined
  // Тело на экране — физическое; строка в растянутой области — со сдвигом слоя.
  const top = body.getBoundingClientRect().top - scrollLayer(scroller).shift()
  return { start: top + item.start, end: top + item.end }
}

/**
 * Последняя строка — вместе с незакреплённым футером под ней: по низу встаёт и он
 * (ADR 0118, §6). Футер в потоке строк не закрывает и окно не сужает.
 */
const withInlineFooter = (
  span: Span | null | undefined,
  viewport: ScrollViewport,
  scroller: HTMLElement,
  index: number | undefined,
) => {
  if (!span || index !== viewport.rows.options.count - 1) return span
  const footer = scroller.querySelector<HTMLElement>(
    ".data-grid__footer[data-position='inline']",
  )
  return footer
    ? {
        start: span.start,
        end: span.end + footer.getBoundingClientRect().height,
      }
    : span
}

/** Колонка на экране: по замерам виртуализатора колонок или по ячейке шапки. */
const plannedColumn = (
  table: ScrollTable,
  viewport: ScrollViewport,
  scroller: HTMLElement,
  columnId: string,
): { span: Span; reference: HTMLElement } | undefined => {
  const head = scroller.querySelector<HTMLElement>(
    `${HEAD_CELL_SELECTOR}${cellSelector(columnId)}`,
  )
  const reference =
    head ?? scroller.querySelector<HTMLElement>(HEAD_CELL_SELECTOR)
  if (!reference) return undefined
  if (head && !viewport.columns) {
    return { span: horizontal(head.getBoundingClientRect()), reference }
  }
  const index = getDisplayColumns(table as never).indexById.get(columnId)
  const item =
    index === undefined ? undefined : viewport.columns?.measurementsCache[index]
  const row = reference.closest('[role="row"]')
  if (!item || !row) return undefined
  const left = row.getBoundingClientRect().left
  return { span: { start: left + item.start, end: left + item.end }, reference }
}

interface Target {
  rowId?: string
  index?: number
  columnId?: string
  align: ScrollAlign
  behavior: 'instant' | 'smooth'
}

/**
 * Один прыжок по замерам — строки на новом месте монтируются до входа в быструю
 * прокрутку и приходят с содержимым (BT6). Затем проверка по DOM: при строках разной
 * высоты оценка промахивается, довод повторяется. Плавно — только первый ход: хвост
 * плавной прокрутки Firefox ползёт долями пикселя и сходит за остановку.
 */
const place = async (
  table: ScrollTable,
  viewport: ScrollViewport,
  scroller: HTMLElement,
  target: Target,
  alive: () => boolean,
) => {
  const plan: ScrollTarget = {}
  let behavior = target.behavior
  if (target.index !== undefined) {
    const row = withInlineFooter(
      plannedRow(viewport, scroller, target.index),
      viewport,
      scroller,
      target.index,
    )
    if (row) {
      plan.top = offsetFor(
        scrollLayer(scroller).top(),
        row,
        bodyArea(scroller),
        target.align,
      )
    }
  }
  if (target.columnId !== undefined) {
    const column = plannedColumn(table, viewport, scroller, target.columnId)
    if (column) {
      plan.left = offsetFor(
        scroller.scrollLeft,
        column.span,
        centerArea(column.reference, scroller),
        'auto',
      )
    }
  }
  if (plan.top !== undefined || plan.left !== undefined) {
    scrollGridTo(scroller, plan, behavior)
    await settle(scroller, alive, behavior === 'smooth')
    behavior = 'instant'
  }

  for (let attempt = 0; attempt < 5 && alive(); attempt++) {
    const row =
      target.rowId === undefined
        ? undefined
        : rowElement(scroller, target.rowId)
    if (target.rowId !== undefined && !row) {
      // Строки разной высоты: прыжок по оценке промахнулся мимо окна.
      const planned = withInlineFooter(
        plannedRow(viewport, scroller, target.index!),
        viewport,
        scroller,
        target.index,
      )
      if (!planned) return false
      scrollGridTo(
        scroller,
        {
          top: offsetFor(
            scrollLayer(scroller).top(),
            planned,
            bodyArea(scroller),
            target.align,
          ),
        },
        'instant',
      )
      await settle(scroller, alive)
      continue
    }
    const cell =
      target.columnId === undefined
        ? undefined
        : ((row
            ? row.querySelector<HTMLElement>(cellSelector(target.columnId))
            : scroller.querySelector<HTMLElement>(
                `${HEAD_CELL_SELECTOR}${cellSelector(target.columnId)}`,
              )) ?? undefined)
    if (target.columnId !== undefined && !cell) {
      await frame()
      continue
    }
    const rowSpan = withInlineFooter(
      row && vertical(row.getBoundingClientRect()),
      viewport,
      scroller,
      target.index,
    )
    const cellSpan = cell && horizontal(cell.getBoundingClientRect())
    const rowPlaced =
      !rowSpan || isPlaced(rowSpan, bodyArea(scroller), target.align)
    const cellPlaced =
      !cellSpan || isPlaced(cellSpan, centerArea(cell!, scroller), 'auto')
    if (rowPlaced && cellPlaced) return true
    const before = [scrollLayer(scroller).top(), scroller.scrollLeft]
    scrollGridTo(
      scroller,
      {
        top: rowSpan
          ? offsetFor(
              scrollLayer(scroller).top(),
              rowSpan,
              bodyArea(scroller),
              target.align,
            )
          : undefined,
        left: cellSpan
          ? offsetFor(
              scroller.scrollLeft,
              cellSpan,
              centerArea(cell!, scroller),
              'auto',
            )
          : undefined,
      },
      behavior,
    )
    await settle(scroller, alive, behavior === 'smooth')
    behavior = 'instant'
    // Прокрутка упёрлась в край (последняя строка к верху окна) — ближе не встать.
    if (
      scrollLayer(scroller).top() === before[0] &&
      scroller.scrollLeft === before[1]
    ) {
      return true
    }
  }
  return false
}

const calls = new WeakMap<object, number>()

/** Новый вызов перебивает прошлый (SV9): `alive` прошлого становится ложным. */
const startCall = (table: ScrollTable) => {
  const call = (calls.get(table.store) ?? 0) + 1
  calls.set(table.store, call)
  return () => calls.get(table.store) === call
}

/** Горизонталь к колонке по ячейке шапки — докрутка подсветки колонки (SV10). */
export const revealColumn = async (
  tableArg: unknown,
  columnId: string,
  behavior: 'instant' | 'smooth' = 'instant',
): Promise<boolean> => {
  const table = tableArg as ScrollTable
  const alive = startCall(table)
  const viewport = viewportOf(table)
  const scroller = viewport?.getScrollElement()
  const column = table.getColumn(columnId)
  if (!viewport || !scroller || !column?.getIsVisible()) return false
  if (column.getIsPinned()) return true
  const shown = await place(
    table,
    viewport,
    scroller,
    { columnId, align: 'auto', behavior },
    alive,
  )
  return shown && alive()
}

/**
 * Строка по индексу пришла (ADR 0138, §12): клиентская — сразу, серверная — когда
 * придёт её блок; `undefined` — блок отказал, грид ушёл или вызов перебит.
 */
const loadedRow = async (
  table: ScrollTable,
  index: number,
  scroller: HTMLElement,
  alive: () => boolean,
) => {
  const source = table.getRowSource()
  for (;;) {
    if (!alive() || !scroller.isConnected) return undefined
    const row = source.at(index)
    if (row) return row
    const failed =
      source.loadError?.() !== undefined ||
      (source.failures?.() ?? []).some(
        failure => index >= failure.start && index < failure.end,
      )
    if (failed) return undefined
    await frame()
  }
}

/**
 * Индекс строки на её странице. У источника со страницами индекс сквозной: строка другой
 * страницы — сперва переход на неё (ADR 0158, §5); `undefined` — вызов перебит.
 */
const pageLocalIndex = async (
  table: ScrollTable,
  listIndex: number,
  alive: () => boolean,
) => {
  const source = table.getRowSource()
  if (!source.offset) return listIndex
  const page = source.pageOf?.(listIndex)
  if (
    page !== undefined &&
    page !== paginationOf(table)?.pageIndex &&
    table.setPageIndex
  ) {
    table.setPageIndex(page)
    // Тело перерисовано и прокручено к началу страницы (ADR 0038) — до прокрутки к строке.
    if (!(await until(() => paginationOf(table)?.pageIndex === page, alive)))
      return undefined
    await frame()
  }
  return listIndex - source.offset()
}

/** Прыжок по индексу, загрузка строки и доводка по ней; `rowId` — ждём именно её. */
const toIndex = async (
  table: ScrollTable,
  viewport: ScrollViewport,
  scroller: HTMLElement,
  listIndex: number,
  alive: () => boolean,
  target: Pick<Target, 'align' | 'behavior' | 'columnId' | 'rowId'>,
) => {
  const index = await pageLocalIndex(table, listIndex, alive)
  if (index === undefined || !alive()) return false
  if (index < 0 || index >= table.getRowSource().count()) return false
  await place(
    table,
    viewport,
    scroller,
    { index, align: target.align, behavior: target.behavior },
    alive,
  )
  const row = await loadedRow(table, index, scroller, alive)
  if (!row || (target.rowId !== undefined && row.id !== target.rowId)) {
    return false
  }
  const placed = await place(
    table,
    viewport,
    scroller,
    { ...target, rowId: row.id, index, behavior: 'instant' },
    alive,
  )
  return placed && alive()
}

export const scrollToRowIndex = async (
  tableArg: unknown,
  index: number,
  options: ScrollToRowIndexOptions = {},
): Promise<boolean> => {
  const table = tableArg as ScrollTable
  const alive = startCall(table)
  const { align = 'auto', behavior = 'instant', columnId } = options
  const viewport = viewportOf(table)
  const scroller = viewport?.getScrollElement()
  if (!viewport || !scroller) return false
  const column = columnId === undefined ? undefined : table.getColumn(columnId)
  if (columnId !== undefined && !column?.getIsVisible()) return false
  return toIndex(table, viewport, scroller, index, alive, {
    align,
    behavior,
    columnId: column?.getIsPinned() ? undefined : columnId,
  })
}

export const scrollToRow = async (
  tableArg: unknown,
  rowId: string,
  options: ScrollToRowOptions = {},
): Promise<boolean> => {
  const table = tableArg as ScrollTable
  const alive = startCall(table)

  const {
    align = 'auto',
    behavior = 'instant',
    columnId,
    expandParents = false,
  } = options
  const viewport = viewportOf(table)
  const scroller = viewport?.getScrollElement()
  if (!viewport || !scroller) return false
  const column = columnId === undefined ? undefined : table.getColumn(columnId)
  if (columnId !== undefined && !column?.getIsVisible()) return false

  let index = indexOf(table, rowId)
  // Строка загружена на другой странице серверной модели (ADR 0158) — по её сквозному
  // индексу; не загружена — по подсказке.
  const listIndex =
    index === -1 ? (table.getRowSource().listIndexOf?.(rowId) ?? -1) : -1
  const hint = listIndex !== -1 ? listIndex : options.index
  if (index === -1 && hint !== undefined) {
    return toIndex(table, viewport, scroller, hint, alive, {
      align,
      behavior,
      columnId: column?.getIsPinned() ? undefined : columnId,
      rowId,
    })
  }

  if (index === -1) {
    const path = pathTo(table, rowId)
    if (!path) return false
    const collapsed = path.slice(0, -1).filter(row => !row.getIsExpanded())
    if (collapsed.length > 0 && !expandParents) return false
    // Предок, которого раскрыть нельзя (`maxDepth`), — отказ без смены состояния.
    if (collapsed.some(row => !row.getCanExpand())) return false
    const page = pageOf(table, path[0])
    if (page !== undefined && page !== paginationOf(table)?.pageIndex) {
      table.setPageIndex!(page)
    }
    if (collapsed.length > 0) {
      // Одним обновлением: два `toggleExpanded` подряд считаются от одного прежнего среза.
      table.setExpanded?.(old =>
        old === true
          ? true
          : {
              ...old,
              ...Object.fromEntries(collapsed.map(row => [row.id, true])),
            },
      )
    }
    // Строка в модели и в виртуализаторе: грид перерисовался после смены состояния. На
    // другой странице серверной модели — по её сквозному индексу (ADR 0158).
    let pageIndex = -1
    const arrived = await until(() => {
      index = indexOf(table, rowId)
      if (index === -1) {
        pageIndex = table.getRowSource().listIndexOf?.(rowId) ?? -1
        return pageIndex !== -1
      }
      return viewport.rows.options.count > index
    }, alive)
    if (!arrived) return false
    if (index === -1) {
      return toIndex(table, viewport, scroller, pageIndex, alive, {
        align,
        behavior,
        columnId: column?.getIsPinned() ? undefined : columnId,
        rowId,
      })
    }
  }

  const placed = await place(
    table,
    viewport,
    scroller,
    {
      rowId,
      index,
      columnId: column?.getIsPinned() ? undefined : columnId,
      align,
      behavior,
    },
    alive,
  )
  return placed && alive()
}

export const scrollToRowFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('scrollToRowFeature', table, {
      table_scrollToRow: {
        fn: (rowId: string, options?: ScrollToRowOptions) => {
          const id = reportAction(table, {
            plugin: 'core',
            action: 'scrollToRow',
            detail: { rowId },
          })
          const done = scrollToRow(table, rowId, options)
          if (id !== undefined) {
            void done.then(found =>
              reportAction(table, {
                plugin: 'core',
                action: found ? 'scrollToRowResolved' : 'scrollToRowRejected',
                source: 'auto',
                cause: id,
              }),
            )
          }
          return done
        },
      },
      table_scrollToRowIndex: {
        fn: (index: number, options?: ScrollToRowIndexOptions) => {
          const id = reportAction(table, {
            plugin: 'core',
            action: 'scrollToRowIndex',
            detail: { index },
          })
          const done = scrollToRowIndex(table, index, options)
          if (id !== undefined) {
            void done.then(found =>
              reportAction(table, {
                plugin: 'core',
                action: found
                  ? 'scrollToRowIndexResolved'
                  : 'scrollToRowIndexRejected',
                source: 'auto',
                cause: id,
              }),
            )
          }
          return done
        },
      },
    })
  },
}
