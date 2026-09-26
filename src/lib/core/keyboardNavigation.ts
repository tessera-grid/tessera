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
import { type KeyboardAction, keyComboOf } from './keyboardActions'
import { useTableState } from './reactivity'

export const KEYBOARD_NAVIGATION = 'keyboardNavigation'

/**
 * Индекс листовой строки заголовка в модели навигации. Строки групп вложенной
 * шапки — выше: от `-headerRowCount` (верхняя) до `-2`.
 */
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

/** Атрибут строки `treegrid` — участника навигации в режиме фокуса на строке. */
export const NAV_ROW_ATTR = 'data-kn-row'

/** `columnIndex` фокуса на самой строке `treegrid` (ADR 0032, W16). */
export const ROW_FOCUS_COLUMN = -1

const NAV_TARGET_SELECTOR = `[${NAV_CELL_ATTR}], [${NAV_ROW_ATTR}]`

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
  parentId?: string
  getVisibleCells: () => NavCell[]
  getCanExpand?: () => boolean
  getIsExpanded?: () => boolean
}

type NavColumn = { id: string }

interface NavCellRange {
  anchorRowId: string
  anchorColumnId: string
  focusRowId: string
  focusColumnId: string
}

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
  setCellSelection?: (updater: (old: NavCellRange[]) => NavCellRange[]) => void
  selectAllCells?: () => void
  getColumn?: (
    id: string,
  ) => { columnDef: { enableCellSelection?: unknown } } | undefined
  getHeaderGroups: () => { headers: NavHeader[] }[]
  getKeyboardActions?: () => KeyboardAction[] | undefined
  getFocusedCell?: () =>
    { row: { id: string }; column: { id: string } } | undefined
}

export const isKeyboardNavigationEnabled = (table: unknown): boolean =>
  !!(table as NavTable).options.enableKeyboardNavigation

/**
 * Иерархия строк (`rowExpanding` / `rowGrouping` включены): с клавиатурной
 * навигацией грид — `treegrid` (ADR 0032, W10, W16).
 */
export const isTreeGrid = (table: unknown): boolean => {
  const { options } = table as NavTable
  return options.enableExpanding === true || options.enableGrouping === true
}

const clampActive = (
  raw: ActiveCell | undefined,
  rowCount: number,
  columnCount: number,
  headerRowCount: number,
): ActiveCell => ({
  rowIndex: Math.min(
    Math.max(raw?.rowIndex ?? HEADER_ROW_INDEX, -headerRowCount),
    rowCount - 1,
  ),
  columnIndex: Math.min(
    Math.max(raw?.columnIndex ?? 0, 0),
    Math.max(columnCount - 1, 0),
  ),
})

/**
 * Строк в модели навигации: тело и, при `enableFooter`, строка футера сразу после
 * последней строки тела (ADR 0032, W14).
 */
const getNavRowCount = (t: NavTable) =>
  t.getRowModel().rows.length + (t.options.enableFooter ? 1 : 0)

/** Индекс строки навигации — футер (за последней строкой тела). */
export const isFooterRowIndex = (table: unknown, rowIndex: number) =>
  rowIndex >= (table as NavTable).getRowModel().rows.length

const resolveActive = (t: NavTable, state: Record<string, unknown>) => {
  const raw = state[KEYBOARD_NAVIGATION] as ActiveCell | undefined
  const active = clampActive(
    raw,
    getNavRowCount(t),
    getDisplayColumns(t).ids.length,
    t.getHeaderGroups().length,
  )
  // Фокус на строке — только у строк тела treegrid.
  return raw?.columnIndex === ROW_FOCUS_COLUMN &&
    isTreeGrid(t) &&
    active.rowIndex >= 0 &&
    !isFooterRowIndex(t, active.rowIndex)
    ? { ...active, columnIndex: ROW_FOCUS_COLUMN }
    : active
}

// --- Шапка: владелец позиции -------------------------------------------------------

interface NavHeader {
  id: string
  isPlaceholder: boolean
  column: { id: string; depth: number; columnDef: { rowSpan?: number } }
  getLeafHeaders: () => { column: { id: string } }[]
  getContext: () => unknown
}

/**
 * Строки шапки, которые заголовок занимает визуально (0 — верхняя), как в
 * `useGridStyles`: `rowSpan > 0` — с первой строки, иначе — строка глубины
 * колонки. Плейсхолдер и `rowSpan: 0` не рисуются — пусто.
 */
const getHeaderRows = (header: NavHeader): number[] => {
  const { rowSpan } = header.column.columnDef
  if (header.isPlaceholder || rowSpan === 0) {
    return []
  }
  return typeof rowSpan === 'number' && rowSpan > 0
    ? Array.from({ length: rowSpan }, (_, row) => row)
    : [header.column.depth]
}

/** Индекс строки навигации заголовка: его верхняя видимая строка (`< 0`). */
export const getHeaderRowIndex = (
  header: unknown,
  headerRowCount: number,
): number =>
  (getHeaderRows(header as NavHeader)[0] ?? headerRowCount - 1) - headerRowCount

const headerOwnerGrids = new WeakMap<object, (NavHeader | undefined)[][]>()

/**
 * Сетка владельцев шапки `[строка][колонка]`: заголовок, чей бокс покрывает
 * позицию (группа — несколько колонок, `rowSpan` — несколько строк).
 */
const getHeaderOwnerGrid = (t: NavTable) => {
  const groups = t.getHeaderGroups()
  let grid = headerOwnerGrids.get(groups)
  if (!grid) {
    const { indexById } = getDisplayColumns(t)
    const owners: (NavHeader | undefined)[][] = groups.map(() => [])
    for (const group of groups) {
      for (const header of group.headers) {
        const rows = getHeaderRows(header)
        for (const leaf of header.getLeafHeaders()) {
          const column = indexById.get(leaf.column.id)
          if (column === undefined) continue
          for (const row of rows) {
            if (owners[row]) owners[row][column] = header
          }
        }
      }
    }
    grid = owners
    headerOwnerGrids.set(groups, grid)
  }
  return grid
}

/** Заголовок, владеющий позицией `(rowIndex < 0, columnIndex)` шапки. */
const getHeaderOwner = (
  t: NavTable,
  rowIndex: number,
  columnIndex: number,
): NavHeader | undefined => {
  const grid = getHeaderOwnerGrid(t)
  return grid[grid.length + rowIndex]?.[columnIndex]
}

/**
 * Стрелка в шапке переходит к следующему владельцу: шаг сквозь бокс, растянутый на
 * несколько колонок (группа) или строк (лист с `rowSpan`); за краем — на месте.
 */
const skipHeaderSpans = (
  t: NavTable,
  active: ActiveCell,
  next: ActiveCell,
  key: string,
): ActiveCell => {
  if (next.rowIndex >= 0) {
    return next
  }
  const current =
    active.rowIndex < 0
      ? getHeaderOwner(t, active.rowIndex, active.columnIndex)
      : undefined
  const same = (row: number, column: number) =>
    getHeaderOwner(t, row, column) === current
  const top = -t.getHeaderGroups().length
  const lastRow = getNavRowCount(t) - 1
  const lastColumn = getDisplayColumns(t).ids.length - 1
  let { rowIndex, columnIndex } = next
  switch (key) {
    case 'ArrowUp':
      while (rowIndex >= top && same(rowIndex, columnIndex)) rowIndex--
      return rowIndex < top ? active : { rowIndex, columnIndex }
    case 'ArrowDown':
      while (rowIndex < 0 && same(rowIndex, columnIndex)) rowIndex++
      return rowIndex > lastRow ? active : { rowIndex, columnIndex }
    case 'ArrowLeft':
      while (columnIndex >= 0 && same(rowIndex, columnIndex)) columnIndex--
      return columnIndex < 0 ? active : { rowIndex, columnIndex }
    case 'ArrowRight':
      while (columnIndex <= lastColumn && same(rowIndex, columnIndex))
        columnIndex++
      return columnIndex > lastColumn ? active : { rowIndex, columnIndex }
    default:
      return next
  }
}

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
  /** Число строк шапки (> 1 — вложенная); по умолчанию 1. */
  headerRowCount?: number
}

/**
 * Следующая активная ячейка по клавише или `null`, если клавиша не навигационная.
 * Строки — от `-headerRowCount` (верх шапки) до `rowCount - 1`; кламп на краях.
 */
export const resolveNavigationKey = (
  active: ActiveCell,
  event: NavigationKeyEvent,
  { rowCount, columnCount, pageRows, headerRowCount = 1 }: NavigationBounds,
): ActiveCell | null => {
  if (event.shiftKey) {
    return null
  }
  const lastRow = rowCount - 1
  const lastColumn = Math.max(columnCount - 1, 0)
  const clampRow = (row: number) =>
    Math.min(Math.max(row, -headerRowCount), lastRow)
  const clampColumn = (column: number) =>
    Math.min(Math.max(column, 0), lastColumn)
  const ctrl = event.ctrlKey || event.metaKey
  const { rowIndex, columnIndex } = active

  // Alt+↑/↓ — на экран: замена PageUp/PageDown для компактных клавиатур (KB13).
  if (event.altKey) {
    if (ctrl) {
      return null
    }
    if (event.key === 'ArrowUp') {
      return { rowIndex: clampRow(rowIndex - pageRows), columnIndex }
    }
    if (event.key === 'ArrowDown') {
      return { rowIndex: clampRow(rowIndex + pageRows), columnIndex }
    }
    return null
  }

  // Ctrl+стрелка — к краю: замена Home/End и Ctrl+Home/End (KB11).
  switch (event.key) {
    case 'ArrowUp':
      return {
        rowIndex: ctrl ? -headerRowCount : clampRow(rowIndex - 1),
        columnIndex,
      }
    case 'ArrowDown':
      return { rowIndex: clampRow(ctrl ? lastRow : rowIndex + 1), columnIndex }
    case 'ArrowLeft':
      return { rowIndex, columnIndex: ctrl ? 0 : clampColumn(columnIndex - 1) }
    case 'ArrowRight':
      return {
        rowIndex,
        columnIndex: ctrl ? lastColumn : clampColumn(columnIndex + 1),
      }
    case 'Home':
      return ctrl
        ? { rowIndex: -headerRowCount, columnIndex: 0 }
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
  isSticky: boolean,
) => {
  const rect = cell.getBoundingClientRect()
  if (!isSticky) {
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
  /** Идёт ввод указателем: фокус от него не перенаправляется на активную ячейку. */
  pointer: boolean
  /** Строка/колонка, за которой активная ячейка следует после перестановки. */
  follow?: { rowId?: string; columnId?: string }
}

const focusTracking = new WeakMap<object, FocusTracking>()

// Ключ — общий store: React-адаптер отдаёт гриду другой объект таблицы, чем
// `cell.getContext().table`, а store у них один.
const trackingOf = (table: NavTable): FocusTracking => {
  let tracking = focusTracking.get(table.store)
  if (!tracking) {
    tracking = { pending: false, within: false, pointer: false }
    focusTracking.set(table.store, tracking)
  }
  return tracking
}

/**
 * Перевести активную ячейку на новую позицию её строки/колонки после действия,
 * переставившего их (перенос колонки — сразу, строки — когда придут новые данные).
 */
const applyFollow = (t: NavTable) => {
  const tracking = trackingOf(t)
  const follow = tracking.follow
  if (!follow) {
    return
  }
  const active = resolveActive(t, t.store.get())
  const rowIndex =
    follow.rowId === undefined
      ? active.rowIndex
      : t.getRowModel().rows.findIndex(row => row.id === follow.rowId)
  const columnIndex =
    follow.columnId === undefined
      ? undefined
      : getDisplayColumns(t).indexById.get(follow.columnId)
  if (follow.rowId !== undefined && rowIndex === -1) {
    return
  }
  const next = { rowIndex, columnIndex: columnIndex ?? active.columnIndex }
  if (
    next.rowIndex === active.rowIndex &&
    next.columnIndex === active.columnIndex
  ) {
    return
  }
  tracking.follow = undefined
  tracking.pending = true
  setPluginState(t, KEYBOARD_NAVIGATION, next)
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

/** Сдвинуть фокус активного диапазона до края таблицы в направлении `direction`. */
const extendSelectionToEdge = (t: NavTable, direction: Direction) => {
  const rows = t.getRowModel().rows
  // Как у стоковой фичи: колонка вне выбора только по column-level opt-out.
  const columnIds = getDisplayColumns(t).ids.filter(
    id => t.getColumn?.(id)?.columnDef.enableCellSelection !== false,
  )
  const vertical = direction === 'up' || direction === 'down'
  const ids = vertical ? rows.map(row => row.id) : columnIds
  const target =
    direction === 'up' || direction === 'left' ? ids[0] : ids.at(-1)
  if (target === undefined) {
    return
  }
  const key = vertical ? 'focusRowId' : 'focusColumnId'
  t.setCellSelection?.(old =>
    old.length
      ? [...old.slice(0, -1), { ...old[old.length - 1], [key]: target }]
      : old,
  )
}

/**
 * Shift+стрелка: расширить диапазон на шаг, Ctrl+Shift+стрелка — до края таблицы;
 * якорь — активная ячейка.
 */
const extendSelectionFrom = (
  t: NavTable,
  active: ActiveCell,
  direction: Direction,
  toEdge: boolean,
): boolean => {
  if (
    !isCellSelectionActive(t) ||
    typeof t.extendCellSelection !== 'function' ||
    t.options.enableCellRangeSelection === false ||
    active.rowIndex < 0 ||
    isFooterRowIndex(t, active.rowIndex) ||
    active.columnIndex === ROW_FOCUS_COLUMN
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
  if (toEdge) {
    extendSelectionToEdge(t, direction)
  } else {
    t.extendCellSelection(direction)
  }
  return true
}

const isSelectAllKey = (event: NavigationKeyEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === 'a'

/** Ctrl+A: выделить все ячейки; без cellSelection клавиша остаётся браузеру. */
const selectAllCellsIn = (t: NavTable): boolean => {
  if (
    !isCellSelectionActive(t) ||
    typeof t.selectAllCells !== 'function' ||
    t.options.enableCellRangeSelection === false
  ) {
    return false
  }
  t.selectAllCells()
  return true
}

// --- Режим действия, действия плагинов, стражи Tab --------------------------------

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
  '[contenteditable="true"]',
]
  .map(
    selector =>
      `${selector}:not([tabindex="-1"]):not([disabled]):not([aria-hidden="true"])`,
  )
  .join(',')

/** Интерактивные виджеты внутри ячейки (кнопки, чекбоксы, поля) в DOM-порядке. */
const getCellWidgets = (cell: HTMLElement): HTMLElement[] =>
  Array.from(cell.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    widget => widget.getClientRects().length > 0,
  )

const isFocusLost = () =>
  document.activeElement === null || document.activeElement === document.body

/**
 * Вернуть фокус на ячейку, если сфокусированный виджет исчез из DOM (редактор
 * закрылся после коммита, меню размонтировалось). Проверка — после ре-рендера.
 */
const restoreFocusIfLost = (cell: HTMLElement) => {
  setTimeout(() => {
    if (isFocusLost() && cell.isConnected) {
      cell.focus({ preventScroll: true })
    }
  }, 0)
}

const ACTION_KEYS = new Set([' ', 'Enter', 'F2'])

/** `Ctrl+Shift+Enter` — замена `Shift+F10` для клавиатур без F-ряда (KB14). */
const isContextMenuKey = (event: ReactKeyboardEvent<HTMLElement>) =>
  event.key === 'ContextMenu' ||
  (event.key === 'F10' && event.shiftKey) ||
  (event.key === 'Enter' &&
    event.shiftKey &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey)

/** Контекст активной ячейки для канала `keyboardActions`. */
const resolveActionTarget = (
  t: NavTable,
  active: ActiveCell,
): { scope: KeyboardAction['scope']; ctx: unknown } | null => {
  if (active.rowIndex < 0) {
    const header = getHeaderOwner(t, active.rowIndex, active.columnIndex)
    return header ? { scope: 'header', ctx: header.getContext() } : null
  }
  const cell = t.getRowModel().rows[active.rowIndex]?.getVisibleCells()[
    active.columnIndex
  ] as { getContext?: () => unknown } | undefined
  return cell?.getContext ? { scope: 'cell', ctx: cell.getContext() } : null
}

/**
 * Раскрыть/свернуть строку тем же путём, что и кнопка: действие канала с флагом
 * `expands`, применимое к одной из ячеек строки. `false` — строку не раскрыть.
 */
const toggleRowExpansion = (
  t: NavTable,
  rowIndex: number,
  event: ReactKeyboardEvent<HTMLElement>,
): boolean => {
  const row = t.getRowModel().rows[rowIndex]
  const actions = (t.getKeyboardActions?.() ?? []).filter(
    action => action.scope === 'cell' && action.expands,
  )
  const cells = (row?.getVisibleCells() ?? []) as {
    getContext?: () => unknown
  }[]
  for (const cell of cells) {
    const ctx = cell.getContext?.()
    const action = actions.find(a => a.visible?.(ctx as never) ?? true)
    if (ctx && action) {
      action.run(ctx as never, event)
      return true
    }
  }
  return false
}

/**
 * Клавиши в режиме фокуса на строке treegrid (паттерн APG Treegrid): следующая
 * активная позиция, `'handled'` — клавиша обработана на месте, `null` — не наша.
 */
const resolveRowFocusKey = (
  t: NavTable,
  active: ActiveCell,
  event: ReactKeyboardEvent<HTMLElement>,
): ActiveCell | 'handled' | null => {
  const rows = t.getRowModel().rows
  const row = rows[active.rowIndex]
  const atRow = (rowIndex: number): ActiveCell => ({
    rowIndex: Math.min(Math.max(rowIndex, 0), rows.length - 1),
    columnIndex: ROW_FOCUS_COLUMN,
  })
  switch (event.key) {
    case 'ArrowRight':
      if (row?.getCanExpand?.() && !row.getIsExpanded?.()) {
        return toggleRowExpansion(t, active.rowIndex, event) ? 'handled' : null
      }
      return { rowIndex: active.rowIndex, columnIndex: 0 }
    case 'ArrowLeft': {
      if (row?.getIsExpanded?.()) {
        return toggleRowExpansion(t, active.rowIndex, event) ? 'handled' : null
      }
      const parent = rows.findIndex(r => r.id === row?.parentId)
      return parent === -1 ? 'handled' : atRow(parent)
    }
    case 'ArrowUp':
      return atRow(active.rowIndex - 1)
    case 'ArrowDown':
      return atRow(active.rowIndex + 1)
    case 'Home':
      return atRow(0)
    case 'End':
      return atRow(rows.length - 1)
    default:
      return null
  }
}

/** Первое применимое действие плагина для клавиши на активной ячейке. */
const findKeyboardAction = (
  t: NavTable,
  target: { scope: KeyboardAction['scope']; ctx: unknown },
  key: string,
): KeyboardAction | undefined =>
  (t.getKeyboardActions?.() ?? []).find(
    action =>
      action.scope === target.scope &&
      action.keys.includes(key) &&
      (action.visible?.(target.ctx as never) ?? true),
  )

/** Клавиши внутри виджета ячейки: `Escape` — на ячейку, `Tab` — по виджетам по кругу. */
const POPUP_SELECTOR = '[role="menu"], [role="dialog"], [role="listbox"]'

const handleActionModeKey = (
  event: ReactKeyboardEvent<HTMLElement>,
  cell: HTMLElement,
) => {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    // Escape во всплывающем окне виджета (меню, диалог) закрывает его само и
    // возвращает фокус на кнопку-триггер; на ячейку — следующий Escape.
    if ((event.target as HTMLElement).closest?.(POPUP_SELECTOR)) {
      return
    }
    event.preventDefault()
    cell.focus({ preventScroll: true })
    return
  }
  if (event.key === 'Tab' && !event.ctrlKey && !event.altKey) {
    const widgets = getCellWidgets(cell)
    const target = event.target as Node
    const index = widgets.findIndex(widget => widget.contains(target))
    if (widgets.length === 0 || index === -1) {
      return
    }
    event.preventDefault()
    const step = event.shiftKey ? -1 : 1
    widgets[(index + step + widgets.length) % widgets.length].focus()
    return
  }
  restoreFocusIfLost(cell)
}

/** Открыть контекстное меню у ячейки (клавиатурный вызов, центр ячейки). */
const openContextMenuAt = (cell: HTMLElement) => {
  const rect = cell.getBoundingClientRect()
  cell.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }),
  )
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
  onFocusCapture: (event: ReactFocusEvent<HTMLElement>) => void
  onPointerDownCapture: () => void
  /** Стражи Tab-выхода: невидимые `tabindex=-1` до и после контейнера прокрутки. */
  guardBeforeRef: RefObject<HTMLDivElement | null>
  guardAfterRef: RefObject<HTMLDivElement | null>
}

/**
 * Клавиатурный контроллер корня грида; `null` без плагина. В режиме навигации
 * (фокус на ячейке) — стрелки, действия плагинов, вход в режим действия, Tab-выход;
 * в режиме действия (фокус на виджете ячейки) — `Escape` и `Tab` по кругу.
 */
export const useKeyboardNavigationGrid = (
  table: unknown,
  getScrollElement: () => HTMLElement | null,
): KeyboardNavigationGrid | null => {
  const guardBeforeRef = useRef<HTMLDivElement>(null)
  const guardAfterRef = useRef<HTMLDivElement>(null)

  // Перестановка строки применяется, когда потребитель вернёт новые данные.
  useLayoutEffect(() => {
    if (isKeyboardNavigationEnabled(table)) {
      applyFollow(table as NavTable)
    }
  })

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      const cell = target.closest?.<HTMLElement>(NAV_TARGET_SELECTOR)
      if (!cell) {
        return
      }
      if (cell !== target) {
        handleActionModeKey(event, cell)
        return
      }

      const t = table as NavTable
      const modified = event.ctrlKey || event.metaKey || event.altKey
      trackingOf(t).follow = undefined

      // Tab — выход из грида: фокус на стража, нативный обход продолжится от него.
      if (event.key === 'Tab' && !modified) {
        const guard = event.shiftKey
          ? guardBeforeRef.current
          : guardAfterRef.current
        guard?.focus({ preventScroll: true })
        return
      }

      if (isContextMenuKey(event)) {
        if (t.options.enableContextMenu) {
          event.preventDefault()
          openContextMenuAt(cell)
        }
        return
      }

      const active = resolveActive(t, t.store.get())

      // Фокус на строке treegrid: свои клавиши, действия ячеек не применяются.
      if (active.columnIndex === ROW_FOCUS_COLUMN) {
        if (modified || event.shiftKey) {
          return
        }
        const next = resolveRowFocusKey(t, active, event)
        if (next || ACTION_KEYS.has(event.key)) {
          event.preventDefault()
        }
        if (next && next !== 'handled') {
          trackingOf(t).pending = true
          setPluginState(t, KEYBOARD_NAVIGATION, next)
        }
        return
      }
      // `←` на первой ячейке строки treegrid — фокус на саму строку.
      if (
        event.key === 'ArrowLeft' &&
        !modified &&
        !event.shiftKey &&
        active.columnIndex === 0 &&
        active.rowIndex >= 0 &&
        !isFooterRowIndex(t, active.rowIndex) &&
        isTreeGrid(t)
      ) {
        event.preventDefault()
        trackingOf(t).pending = true
        setPluginState(t, KEYBOARD_NAVIGATION, {
          rowIndex: active.rowIndex,
          columnIndex: ROW_FOCUS_COLUMN,
        })
        return
      }

      // Ctrl+Enter — к кнопкам ячейки без её действия: замена F2 (KB12).
      if (
        event.key === 'Enter' &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault()
        getCellWidgets(cell)[0]?.focus()
        return
      }

      if (ACTION_KEYS.has(event.key) && !modified) {
        // Пробел не должен прокручивать контейнер, даже если действия нет.
        event.preventDefault()
        const actionTarget = resolveActionTarget(t, active)
        const action =
          actionTarget && findKeyboardAction(t, actionTarget, event.key)
        if (action && actionTarget) {
          action.run(actionTarget.ctx as never, event)
          restoreFocusIfLost(cell)
          return
        }
        if (event.key !== ' ' && !event.shiftKey) {
          getCellWidgets(cell)[0]?.focus()
        }
        return
      }

      // Сочетания с Alt — действия плагинов (перестановка строк/колонок, ADR 0031).
      if (event.altKey) {
        const actionTarget = resolveActionTarget(t, active)
        const action =
          actionTarget && findKeyboardAction(t, actionTarget, keyComboOf(event))
        if (action && actionTarget) {
          event.preventDefault()
          trackingOf(t).follow = {
            rowId:
              active.rowIndex >= 0
                ? t.getRowModel().rows[active.rowIndex]?.id
                : undefined,
            columnId: getDisplayColumns(t).ids[active.columnIndex],
          }
          action.run(actionTarget.ctx as never, event)
          applyFollow(t)
          return
        }
        // Без действия плагина Alt+↑/↓ листают на экран (KB13).
        const altPage =
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          (event.key === 'ArrowUp' || event.key === 'ArrowDown')
        if (!altPage) {
          return
        }
      }

      if (isSelectAllKey(event)) {
        if (selectAllCellsIn(t)) {
          event.preventDefault()
        }
        return
      }

      const direction = ARROW_DIRECTIONS[event.key]
      if (event.shiftKey && !event.altKey && direction) {
        const toEdge = event.ctrlKey || event.metaKey
        if (extendSelectionFrom(t, active, direction, toEdge)) {
          event.preventDefault()
        }
        return
      }

      const resolved = resolveNavigationKey(active, event, {
        rowCount: getNavRowCount(t),
        columnCount: getDisplayColumns(t).ids.length,
        pageRows: getPageRows(getScrollElement()),
        headerRowCount: t.getHeaderGroups().length,
      })
      if (!resolved) {
        return
      }
      // Прыжки (Ctrl/Alt+стрелка) приземляются как PageUp/Home — без обхода спанов.
      const next = skipHeaderSpans(
        t,
        active,
        resolved,
        modified ? '' : event.key,
      )
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

  // Вход в грид с клавиатуры извне (Tab/Shift+Tab попал на виджет) — на активную
  // ячейку. Фокус от указателя (клик по чекбоксу/полю) не перенаправляем.
  const onFocusCapture = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      const tracking = trackingOf(table as NavTable)
      const root = event.currentTarget
      const from = event.relatedTarget as Node | null
      const target = event.target as HTMLElement
      if (
        tracking.pointer ||
        // Фокус в портале (пункты меню) всплывает по React-дереву — не наш вход.
        !root.contains(target) ||
        (from && root.contains(from)) ||
        // Возврат фокуса на триггер из закрывшегося всплывающего окна (меню в
        // портале уже размонтировано — источника нет); вход по Tab его имеет.
        (from === null && target.hasAttribute('aria-haspopup')) ||
        target.hasAttribute(NAV_CELL_ATTR) ||
        target.hasAttribute(NAV_ROW_ATTR)
      ) {
        return
      }
      const activeCell = root.querySelector<HTMLElement>(
        '[data-kn-active="true"]',
      )
      if (activeCell && activeCell !== target) {
        activeCell.focus({ preventScroll: true })
      }
    },
    [table],
  )

  const onPointerDownCapture = useCallback(() => {
    const tracking = trackingOf(table as NavTable)
    tracking.pointer = true
    tracking.follow = undefined
    // Фокус от указателя приходит в той же задаче ввода (mousedown).
    setTimeout(() => {
      tracking.pointer = false
    }, 0)
  }, [table])

  return isKeyboardNavigationEnabled(table)
    ? {
        onKeyDown,
        onFocusCapture,
        onPointerDownCapture,
        guardBeforeRef,
        guardAfterRef,
      }
    : null
}

// --- Хук ячейки --------------------------------------------------------------------

export interface KeyboardNavigationCell {
  ref: RefObject<HTMLDivElement | null>
  tabIndex: number
  isActive: boolean
  onFocus: (event: ReactFocusEvent<HTMLElement>) => void
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void
}

/**
 * Участие ячейки (заголовка или тела) в навигации; `null` без плагина или при
 * `participates=false` (плейсхолдер шапки) — тогда ячейка не получает ни
 * `tabindex`, ни обработчиков. Заголовок передаёт `headerId` и активен, когда
 * владеет активной позицией шапки; `columnId` у него — первый лист. Активная
 * ячейка несёт `tabindex=0`, по запросу с клавиатуры доводит себя в вид и берёт
 * фокус.
 */
export const useKeyboardNavigationCell = (
  table: unknown,
  rowIndex: number,
  columnId: string,
  participates = true,
  headerId?: string,
): KeyboardNavigationCell | null => {
  const t = table as NavTable
  const ref = useRef<HTMLDivElement>(null)

  const isActive = useTableState(table as never, (state: unknown) => {
    if (!participates || !isKeyboardNavigationEnabled(t)) {
      return null
    }
    const active = resolveActive(t, state as Record<string, unknown>)
    if (headerId !== undefined) {
      return (
        active.rowIndex < 0 &&
        getHeaderOwner(t, active.rowIndex, active.columnIndex)?.id === headerId
      )
    }
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
      // Шапка и футер — sticky: по вертикали доводить не нужно.
      ensureCellVisible(
        el,
        scroller,
        rowIndex < 0 || isFooterRowIndex(t, rowIndex),
      )
    }
    el.focus({ preventScroll: true })
  }, [isActive, t, rowIndex])

  const onFocus = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      // Фокус уже перенаправлен (вход в грид с клавиатуры) — это событие устарело.
      if (event.target !== document.activeElement) {
        return
      }
      trackingOf(t).within = true
      // Фокус внутри виджета ячейки (всплывает) тоже делает ячейку активной.
      const columnIndex = getDisplayColumns(t).indexById.get(columnId)
      const active = resolveActive(t, t.store.get())
      const owned =
        headerId !== undefined &&
        active.rowIndex < 0 &&
        getHeaderOwner(t, active.rowIndex, active.columnIndex)?.id === headerId
      if (
        columnIndex !== undefined &&
        !owned &&
        (active.rowIndex !== rowIndex || active.columnIndex !== columnIndex)
      ) {
        setPluginState(t, KEYBOARD_NAVIGATION, { rowIndex, columnIndex })
      }
    },
    [t, rowIndex, columnId, headerId],
  )

  const onBlur = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      const next = event.relatedTarget as Node | null
      const el = event.currentTarget
      const root = el.closest(SCROLLER_SELECTOR)
      if (next && root?.contains(next)) {
        return
      }
      // Сфокусированный виджет ячейки исчез из DOM (напр. закрылся редактор) —
      // вернуть фокус на ячейку, а не терять его в body.
      const widget = event.target as HTMLElement
      if (widget !== el && !next) {
        setTimeout(() => {
          if (!widget.isConnected && isFocusLost() && el.isConnected) {
            el.focus({ preventScroll: true })
          }
        }, 0)
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

/**
 * Участие строки тела treegrid в навигации (фокус на строке, ADR 0032, W16);
 * `null` вне treegrid или без плагина. Реагирует только на фокус самой строки —
 * фокус ячеек всплывает сквозь неё.
 */
export const useKeyboardNavigationRow = (
  table: unknown,
  rowIndex: number,
): KeyboardNavigationCell | null => {
  const t = table as NavTable
  const ref = useRef<HTMLDivElement>(null)

  const isActive = useTableState(table as never, (state: unknown) => {
    if (!isKeyboardNavigationEnabled(t) || !isTreeGrid(t)) {
      return null
    }
    const active = resolveActive(t, state as Record<string, unknown>)
    return (
      active.rowIndex === rowIndex && active.columnIndex === ROW_FOCUS_COLUMN
    )
  }) as boolean | null

  useLayoutEffect(() => {
    const el = ref.current
    if (!isActive || !el) {
      return
    }
    const tracking = trackingOf(t)
    if (!tracking.pending) {
      return
    }
    tracking.pending = false
    const scroller = el.closest<HTMLElement>(SCROLLER_SELECTOR)
    if (scroller) {
      ensureCellVisible(el, scroller, false)
    }
    el.focus({ preventScroll: true })
  }, [isActive, t])

  const onFocus = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      if (
        event.target !== event.currentTarget ||
        event.target !== document.activeElement
      ) {
        return
      }
      trackingOf(t).within = true
      const active = resolveActive(t, t.store.get())
      if (
        active.rowIndex !== rowIndex ||
        active.columnIndex !== ROW_FOCUS_COLUMN
      ) {
        setPluginState(t, KEYBOARD_NAVIGATION, {
          rowIndex,
          columnIndex: ROW_FOCUS_COLUMN,
        })
      }
    },
    [t, rowIndex],
  )

  const onBlur = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) {
        return
      }
      const el = event.currentTarget
      const next = event.relatedTarget as Node | null
      if (next && el.closest(SCROLLER_SELECTOR)?.contains(next)) {
        return
      }
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
