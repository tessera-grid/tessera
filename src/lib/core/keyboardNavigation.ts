/**
 * Ядровой шов клавиатурной навигации (плагин keyboardNavigation): активная ячейка,
 * roving tabindex, клавиатурный резолвер, довод в вид и фокус. Ядро НЕ импортит
 * плагин — presence читается по опции `enableKeyboardNavigation`, слайс — по ключу
 * `keyboardNavigation` (его seed'ит локальный `state` плагина через definePlugin).
 *
 * Активная ячейка — в модельных индексах: `rowIndex` в `getRowModel().rows`
 * (`-1` — листовая строка заголовка), `columnIndex` — позиция колонки в порядке
 * отображения (закреплённые start → центр → закреплённые end).
 * Ячейки читают «я активна?» гранулярно (`useTableState`): при переходе
 * ре-рендерятся только прежняя и новая активные.
 */
import {
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react'

import { setPluginState } from './definePlugin'
import { getDisplayColumns } from './displayColumns'
import { useTableState } from './reactivity'

export const KEYBOARD_NAVIGATION = 'keyboardNavigation'

/** Индекс строки заголовка в модели навигации. */
export const HEADER_ROW_INDEX = -1

export interface ActiveCell {
  rowIndex: number
  columnIndex: number
}

export const INITIAL_ACTIVE_CELL: ActiveCell = {
  rowIndex: HEADER_ROW_INDEX,
  columnIndex: 0,
}

/** Атрибут ячейки-участника навигации: клавиши обрабатываются только на ней. */
export const NAV_CELL_ATTR = 'data-kn-cell'

const SCROLLER_SELECTOR = '[data-resizing]'
const HEAD_SELECTOR = '.data-grid__head'
const FOOTER_SELECTOR = '.data-grid__footer'
const BODY_ROW_SELECTOR = '.data-grid__body-row'
const FALLBACK_ROW_HEIGHT = 50

type Direction = 'up' | 'down' | 'left' | 'right'

const ARROW_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

interface NavCell {
  getCanSelect?: () => boolean
}

interface NavRow {
  id: string
  getVisibleCells: () => NavCell[]
}

type NavColumn = { id: string }

/** Duck-typed поверхность таблицы, которую читает шов. */
interface NavTable {
  options: Record<string, unknown>
  store: { get: () => Record<string, unknown> }
  getRowModel: () => { rows: NavRow[] }
  getVisibleLeafColumns: () => NavColumn[]
  getStartVisibleLeafColumns?: () => NavColumn[]
  getCenterVisibleLeafColumns?: () => NavColumn[]
  getEndVisibleLeafColumns?: () => NavColumn[]
  // Стоковая фича cellSelection (есть, только если плагин подключён).
  setFocusedCell?: (rowId: string, columnId: string) => void
  extendCellSelection?: (direction: Direction) => void
  getFocusedCell?: () =>
    { row: { id: string }; column: { id: string } } | undefined
}

export const isKeyboardNavigationEnabled = (table: unknown): boolean =>
  !!(table as NavTable).options.enableKeyboardNavigation

const clampActive = (
  raw: ActiveCell | undefined,
  rowCount: number,
  columnCount: number,
): ActiveCell => ({
  rowIndex: Math.min(
    Math.max(raw?.rowIndex ?? HEADER_ROW_INDEX, HEADER_ROW_INDEX),
    rowCount - 1,
  ),
  columnIndex: Math.min(
    Math.max(raw?.columnIndex ?? 0, 0),
    Math.max(columnCount - 1, 0),
  ),
})

const resolveActive = (t: NavTable, state: Record<string, unknown>) =>
  clampActive(
    state[KEYBOARD_NAVIGATION] as ActiveCell | undefined,
    t.getRowModel().rows.length,
    getDisplayColumns(t).ids.length,
  )

// --- Чистый резолвер клавиш ----------------------------------------------------

export interface NavigationKeyEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export interface NavigationBounds {
  rowCount: number
  columnCount: number
  /** Сколько строк помещается в видимую часть тела (шаг PageUp/PageDown). */
  pageRows: number
}

/**
 * Следующая активная ячейка по клавише или `null`, если клавиша не навигационная.
 * Строки — от `-1` (заголовок) до `rowCount - 1`; кламп на краях.
 */
export const resolveNavigationKey = (
  active: ActiveCell,
  event: NavigationKeyEvent,
  { rowCount, columnCount, pageRows }: NavigationBounds,
): ActiveCell | null => {
  if (event.altKey || event.shiftKey) {
    return null
  }
  const lastRow = rowCount - 1
  const lastColumn = Math.max(columnCount - 1, 0)
  const clampRow = (row: number) =>
    Math.min(Math.max(row, HEADER_ROW_INDEX), lastRow)
  const clampColumn = (column: number) =>
    Math.min(Math.max(column, 0), lastColumn)
  const ctrl = event.ctrlKey || event.metaKey
  const { rowIndex, columnIndex } = active

  switch (event.key) {
    case 'ArrowUp':
      return { rowIndex: clampRow(rowIndex - 1), columnIndex }
    case 'ArrowDown':
      return { rowIndex: clampRow(rowIndex + 1), columnIndex }
    case 'ArrowLeft':
      return { rowIndex, columnIndex: clampColumn(columnIndex - 1) }
    case 'ArrowRight':
      return { rowIndex, columnIndex: clampColumn(columnIndex + 1) }
    case 'Home':
      return ctrl
        ? { rowIndex: HEADER_ROW_INDEX, columnIndex: 0 }
        : { rowIndex, columnIndex: 0 }
    case 'End':
      return ctrl
        ? { rowIndex: clampRow(lastRow), columnIndex: lastColumn }
        : { rowIndex, columnIndex: lastColumn }
    case 'PageUp':
      return { rowIndex: clampRow(rowIndex - pageRows), columnIndex }
    case 'PageDown':
      return { rowIndex: clampRow(rowIndex + pageRows), columnIndex }
    default:
      return null
  }
}

// --- Геометрия: видимая область тела и довод в вид ------------------------------

/** Видимая по вертикали часть тела: между низом sticky-шапки и верхом футера. */
const getBodyViewport = (scroller: HTMLElement) => {
  const clientTop = scroller.getBoundingClientRect().top + scroller.clientTop
  const clientBottom = clientTop + scroller.clientHeight
  const head = scroller.querySelector(HEAD_SELECTOR)
  const footer = scroller.querySelector(FOOTER_SELECTOR)
  return {
    top: head
      ? Math.max(clientTop, head.getBoundingClientRect().bottom)
      : clientTop,
    bottom: footer
      ? Math.min(clientBottom, footer.getBoundingClientRect().top)
      : clientBottom,
  }
}

/** Видимая по горизонтали часть: между закреплёнными ячейками строки `cell`. */
const getCenterViewport = (cell: HTMLElement, scroller: HTMLElement) => {
  const clientLeft = scroller.getBoundingClientRect().left + scroller.clientLeft
  let left = clientLeft
  let right = clientLeft + scroller.clientWidth
  const row = cell.closest('[role="row"]') ?? cell.parentElement
  row
    ?.querySelectorAll<HTMLElement>('[data-cell-pinned="left"]')
    .forEach(pinned => {
      left = Math.max(left, pinned.getBoundingClientRect().right)
    })
  row
    ?.querySelectorAll<HTMLElement>('[data-cell-pinned="right"]')
    .forEach(pinned => {
      right = Math.min(right, pinned.getBoundingClientRect().left)
    })
  return { left, right }
}

/**
 * Довести ячейку в видимую область с учётом sticky-шапки/футера и закреплённых
 * колонок (виртуализатор о них не знает). Ячейки заголовка — только по горизонтали,
 * закреплённые — только по вертикали.
 */
const ensureCellVisible = (
  cell: HTMLElement,
  scroller: HTMLElement,
  isHeader: boolean,
) => {
  const rect = cell.getBoundingClientRect()
  if (!isHeader) {
    const { top, bottom } = getBodyViewport(scroller)
    if (rect.top < top) {
      scroller.scrollTop -= top - rect.top
    } else if (rect.bottom > bottom) {
      scroller.scrollTop += rect.bottom - bottom
    }
  }
  const pinned = cell.getAttribute('data-cell-pinned')
  if (pinned !== 'left' && pinned !== 'right') {
    const { left, right } = getCenterViewport(cell, scroller)
    if (rect.left < left) {
      scroller.scrollLeft -= left - rect.left
    } else if (rect.right > right) {
      scroller.scrollLeft += rect.right - right
    }
  }
}

const getPageRows = (scroller: HTMLElement | null): number => {
  if (!scroller) {
    return 1
  }
  const { top, bottom } = getBodyViewport(scroller)
  const rowHeight =
    scroller.querySelector(BODY_ROW_SELECTOR)?.getBoundingClientRect().height ||
    FALLBACK_ROW_HEIGHT
  return Math.max(1, Math.floor((bottom - top) / rowHeight))
}

// --- Фокус: запрос от клавиатуры и восстановление -------------------------------

interface FocusTracking {
  /** Переход с клавиатуры: новая активная ячейка должна взять фокус. */
  pending: boolean
  /** Фокус последним был на ячейке грида (для восстановления после анмаунта). */
  within: boolean
}

const focusTracking = new WeakMap<object, FocusTracking>()

// Ключ — общий store: React-адаптер отдаёт гриду другой объект таблицы, чем
// `cell.getContext().table`, а store у них один.
const trackingOf = (table: NavTable): FocusTracking => {
  let tracking = focusTracking.get(table.store)
  if (!tracking) {
    tracking = { pending: false, within: false }
    focusTracking.set(table.store, tracking)
  }
  return tracking
}

// --- Синхронизация с cellSelection ----------------------------------------------

const isCellSelectionActive = (t: NavTable) =>
  typeof t.setFocusedCell === 'function' &&
  t.options.enableCellSelection !== false

/** Схлопнуть выделение в активную ячейку тела, если она выбираема. */
const collapseSelectionTo = (t: NavTable, active: ActiveCell) => {
  if (!isCellSelectionActive(t) || active.rowIndex < 0) {
    return
  }
  const row = t.getRowModel().rows[active.rowIndex]
  const columnId = getDisplayColumns(t).ids[active.columnIndex]
  const cell = row?.getVisibleCells()[active.columnIndex]
  if (!row || !columnId || !(cell?.getCanSelect?.() ?? true)) {
    return
  }
  t.setFocusedCell!(row.id, columnId)
}

/** Shift+стрелка: расширить диапазон, якорь — активная ячейка. */
const extendSelectionFrom = (
  t: NavTable,
  active: ActiveCell,
  direction: Direction,
): boolean => {
  if (
    !isCellSelectionActive(t) ||
    typeof t.extendCellSelection !== 'function' ||
    t.options.enableCellRangeSelection === false ||
    active.rowIndex < 0
  ) {
    return false
  }
  const row = t.getRowModel().rows[active.rowIndex]
  const columnId = getDisplayColumns(t).ids[active.columnIndex]
  const focused = t.getFocusedCell?.()
  if (
    row &&
    columnId &&
    (focused?.row.id !== row.id || focused?.column.id !== columnId)
  ) {
    collapseSelectionTo(t, active)
  }
  t.extendCellSelection(direction)
  return true
}

/**
 * Индекс активной строки/колонки для пиновки в `rangeExtractor`; `undefined` без
 * плагина. Строка заголовка (`-1`) виртуализатором строк не пинуется.
 */
export const useActiveCellIndex = (
  table: unknown,
  axis: keyof ActiveCell,
): number | undefined =>
  useTableState(table as never, (state: unknown) =>
    isKeyboardNavigationEnabled(table)
      ? resolveActive(table as NavTable, state as Record<string, unknown>)[axis]
      : undefined,
  ) as number | undefined

// --- Хук корня грида -------------------------------------------------------------

export interface KeyboardNavigationGrid {
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
}

/**
 * Клавиатурный обработчик корня грида; `null` без плагина. Реагирует только когда
 * фокус на самой ячейке (режим навигации) — нажатия внутри виджетов ячейки не трогает.
 */
export const useKeyboardNavigationGrid = (
  table: unknown,
  getScrollElement: () => HTMLElement | null,
): KeyboardNavigationGrid | null => {
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      if (!target.hasAttribute?.(NAV_CELL_ATTR)) {
        return
      }
      const t = table as NavTable
      const active = resolveActive(t, t.store.get())

      const direction = ARROW_DIRECTIONS[event.key]
      if (event.shiftKey && !event.altKey && direction) {
        if (extendSelectionFrom(t, active, direction)) {
          event.preventDefault()
        }
        return
      }

      const next = resolveNavigationKey(active, event, {
        rowCount: t.getRowModel().rows.length,
        columnCount: getDisplayColumns(t).ids.length,
        pageRows: getPageRows(getScrollElement()),
      })
      if (!next) {
        return
      }
      // Навигационная клавиша не должна прокручивать контейнер нативно.
      event.preventDefault()
      collapseSelectionTo(t, next)
      if (
        next.rowIndex === active.rowIndex &&
        next.columnIndex === active.columnIndex
      ) {
        return
      }
      trackingOf(t).pending = true
      setPluginState(t, KEYBOARD_NAVIGATION, next)
    },
    [table, getScrollElement],
  )

  return isKeyboardNavigationEnabled(table) ? { onKeyDown } : null
}

// --- Хук ячейки --------------------------------------------------------------------

export interface KeyboardNavigationCell {
  ref: RefObject<HTMLDivElement | null>
  tabIndex: number
  isActive: boolean
  onFocus: () => void
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void
}

/**
 * Участие ячейки (заголовка или тела) в навигации; `null` без плагина или при
 * `participates=false` (групповые заголовки) — тогда ячейка не получает ни
 * `tabindex`, ни обработчиков. Активная ячейка несёт
 * `tabindex=0`, по запросу с клавиатуры доводит себя в вид и берёт фокус.
 */
export const useKeyboardNavigationCell = (
  table: unknown,
  rowIndex: number,
  columnId: string,
  participates = true,
): KeyboardNavigationCell | null => {
  const t = table as NavTable
  const ref = useRef<HTMLDivElement>(null)

  const isActive = useTableState(table as never, (state: unknown) => {
    if (!participates || !isKeyboardNavigationEnabled(t)) {
      return null
    }
    const active = resolveActive(t, state as Record<string, unknown>)
    return (
      active.rowIndex === rowIndex &&
      getDisplayColumns(t).ids[active.columnIndex] === columnId
    )
  }) as boolean | null

  useLayoutEffect(() => {
    const el = ref.current
    if (!isActive || !el) {
      return
    }
    const tracking = trackingOf(t)
    // Фокус потерян вместе с размонтированным узлом (напр. после сортировки) —
    // вернуть его активной ячейке.
    const lostFocus =
      tracking.within &&
      (document.activeElement === null ||
        document.activeElement === document.body)
    if (!tracking.pending && !lostFocus) {
      return
    }
    tracking.pending = false
    const scroller = el.closest<HTMLElement>(SCROLLER_SELECTOR)
    if (scroller) {
      ensureCellVisible(el, scroller, rowIndex === HEADER_ROW_INDEX)
    }
    el.focus({ preventScroll: true })
  }, [isActive, t, rowIndex])

  const onFocus = useCallback(() => {
    trackingOf(t).within = true
    // Фокус внутри виджета ячейки (всплывает) тоже делает ячейку активной.
    const columnIndex = getDisplayColumns(t).indexById.get(columnId)
    const active = resolveActive(t, t.store.get())
    if (
      columnIndex !== undefined &&
      (active.rowIndex !== rowIndex || active.columnIndex !== columnIndex)
    ) {
      setPluginState(t, KEYBOARD_NAVIGATION, { rowIndex, columnIndex })
    }
  }, [t, rowIndex, columnId])

  const onBlur = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      const next = event.relatedTarget as Node | null
      const el = event.currentTarget
      const root = el.closest(SCROLLER_SELECTOR)
      if (next && root?.contains(next)) {
        return
      }
      // Узел мог уйти из DOM вместе со строкой — это не уход фокуса из грида.
      queueMicrotask(() => {
        if (el.isConnected) {
          trackingOf(t).within = false
        }
      })
    },
    [t],
  )

  if (isActive === null) {
    return null
  }
  return { ref, tabIndex: isActive ? 0 : -1, isActive, onFocus, onBlur }
}
