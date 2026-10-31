/**
 * Модель клавиатурной навигации: активная ячейка в модельных индексах, константы
 * DOM-атрибутов и duck-typed поверхность таблицы, которую читает шов.
 */
import { type DebugActionSource, reportAction } from '../debugActions'
import { pluginStateKey } from '../definePlugin'
import { getDisplayColumns } from '../displayColumns'
import type { KeyboardAction } from '../keyboardActions'
import { hasRowHierarchy } from '../rowHierarchy'
import type { RowSource } from '../rowSource'

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

/**
 * Атрибут контрола в строке за последней строкой тела (`bodyEndSlot`): `↓` с
 * последней строки переводит фокус в него (ADR 0081).
 */
export const NAV_BODY_END_ATTR = 'data-kn-body-end'

export const NAV_TARGET_SELECTOR = `[${NAV_CELL_ATTR}], [${NAV_ROW_ATTR}]`

export const SCROLLER_SELECTOR = '[data-resizing]'
export const HEAD_SELECTOR = '.data-grid__head'
export const FOOTER_SELECTOR = '.data-grid__footer'
export const BODY_ROW_SELECTOR = '.data-grid__body-row'
export const FALLBACK_ROW_HEIGHT = 50

export type Direction = 'up' | 'down' | 'left' | 'right'

export const ARROW_DIRECTIONS: Record<string, Direction> = {
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

/** Duck-typed поверхность таблицы, которую читает шов. */
export interface NavTable {
  options: Record<string, unknown>
  store: { get: () => Record<string, unknown> }
  getRowSource: () => RowSource<NavRow>
  getVisibleLeafColumns: () => NavColumn[]
  getStartVisibleLeafColumns?: () => NavColumn[]
  getCenterVisibleLeafColumns?: () => NavColumn[]
  getEndVisibleLeafColumns?: () => NavColumn[]
  getHeaderGroups: () => { headers: NavHeader[] }[]
  getKeyboardActions?: () => KeyboardAction[] | undefined
}

export interface NavHeader {
  id: string
  rowSpan: number
  headerGroup: { depth: number } | null
  column: { id: string }
  getLeafHeaders: () => { column: { id: string } }[]
  getContext: () => unknown
}

export const isKeyboardNavigationEnabled = (table: unknown): boolean =>
  !!(table as NavTable).options.enableKeyboardNavigation

/**
 * Иерархия строк — факт ядра от модели дерева или группировки (ADR 0168, §4): с клавиатурной
 * навигацией грид — `treegrid` (ADR 0032, W10, W16).
 */
export const isTreeGrid = (table: unknown): boolean =>
  hasRowHierarchy(table, 'tree') || hasRowHierarchy(table, 'groups')

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
export const getNavRowCount = (t: NavTable) =>
  t.getRowSource().count() + (t.options.enableFooter ? 1 : 0)

/** Индекс строки навигации — футер (за последней строкой тела). */
export const isFooterRowIndex = (table: unknown, rowIndex: number) =>
  rowIndex >= (table as NavTable).getRowSource().count()

export const resolveActive = (t: NavTable, state: Record<string, unknown>) => {
  const raw = state[pluginStateKey(KEYBOARD_NAVIGATION)] as
    ActiveCell | undefined
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

/** Навигация — в канал действий от имени ядра (ADR 0125, AL5; ADR 0170, §1). */
export const reportNavigation = (
  table: unknown,
  action: 'moveActiveCell' | 'enterActionMode' | 'exitActionMode',
  source: DebugActionSource,
  detail?: () => unknown,
): void => {
  reportAction(table, { plugin: 'core', action, source, detail })
}
