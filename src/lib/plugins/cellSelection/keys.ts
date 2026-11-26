/**
 * Клавиши выделения ячеек в канале клавиш навигации (ADR 0170, §4): Shift со стрелками и
 * листанием, Ctrl+Shift+Home и End, Ctrl+A; смена активной ячейки схлопывает выделение.
 */
import type {
  NavigationKeyEvent,
  NavigationKeys,
} from '../../core/bodyContributions'
import {
  type KeyboardPlatform,
  keyboardPlatformOf,
  primaryModifier,
} from '../../core/keyboardPlatform'
import { getDisplayColumns } from '../../core/displayColumns'
import { cellSelectionLabels } from './labels'
import { scrollToRowIndex } from '../../core/scrollToRow/scrollToRowFeature'
import {
  ARROW_DIRECTIONS,
  type ActiveCell,
  type Direction,
  type NavTable as CoreNavTable,
  ROW_FOCUS_COLUMN,
  isFooterRowIndex,
} from '../../core/keyboardNavigation/model'
import { isInteractive } from './copyEvent'
import { clearSelection } from './clear'
import { fillFromEdge } from './fill'
import { canPaste } from './paste'

interface CellRange {
  anchorRowId?: string
  anchorColumnId: string
  focusRowId?: string
  focusColumnId: string
  /** В серверной модели строк диапазон — индексы строк (ADR 0146). */
  anchorRowIndex?: number
  focusRowIndex?: number
}

/** Таблица навигации со стоковой фичей выделения ячеек. */
type NavTable = CoreNavTable & {
  setFocusedCell?: (rowId: string, columnId: string) => void
  extendCellSelection?: (direction: Direction) => void
  setCellSelection?: (updater: (old: CellRange[]) => CellRange[]) => void
  selectAllCells?: () => void
  getColumn?: (
    id: string,
  ) => { columnDef: { enableCellSelection?: unknown } } | undefined
  getFocusedCell?: () =>
    { row: { id: string }; column: { id: string } } | undefined
}

/** Клавиши меняют выделение только с плагином интерфейса (ADR 0120). */
const isCellSelectionActive = (t: NavTable) =>
  typeof t.setFocusedCell === 'function' &&
  t.options.enableCellSelection !== false &&
  isInteractive(t)

/** Диапазон — индексы строк: серверная модель строк (ADR 0146). */
const byIndex = (t: NavTable) => t.getRowSource().keyByIndex === true

/** Колонки выделения по настройке колонки — как у стоковой фичи. */
const selectableColumnIds = (t: NavTable) =>
  getDisplayColumns(t).ids.filter(
    id => t.getColumn?.(id)?.columnDef.enableCellSelection !== false,
  )

/**
 * Схлопнуть выделение в активную ячейку тела; на невыбираемой ячейке (служебная
 * колонка, шапка, футер) — снять его, чтобы оно не оставалось позади фокуса.
 */
const collapseSelectionTo = (t: NavTable, active: ActiveCell) => {
  if (!isCellSelectionActive(t)) {
    return
  }
  const row =
    active.rowIndex >= 0 ? t.getRowSource().at(active.rowIndex) : undefined
  const columnId = getDisplayColumns(t).ids[active.columnIndex]
  const cell = row?.getVisibleCells()[active.columnIndex]
  if (
    byIndex(t) &&
    active.rowIndex >= 0 &&
    !isFooterRowIndex(t, active.rowIndex) &&
    columnId &&
    selectableColumnIds(t).includes(columnId) &&
    (cell?.getCanSelect?.() ?? true)
  ) {
    // Незагруженная строка тоже выбираема: её место известно (ADR 0146, §3).
    t.setCellSelection?.(() => [
      {
        anchorRowIndex: active.rowIndex,
        focusRowIndex: active.rowIndex,
        anchorColumnId: columnId,
        focusColumnId: columnId,
      },
    ])
    return
  }
  if (!row || !columnId || !(cell?.getCanSelect?.() ?? true)) {
    t.setCellSelection?.(() => [])
    return
  }
  t.setFocusedCell!(row.id, columnId)
}

/**
 * Сдвинуть фокус активного диапазона: строку — на место `rowIndex`, колонку — на
 * `columnId`; `reveal` — прокрутить к строке фокуса.
 */
const moveRangeFocus = (
  t: NavTable,
  {
    rowIndex,
    columnId,
    reveal = false,
  }: { rowIndex?: number; columnId?: string; reveal?: boolean },
) => {
  const rows = t.getRowSource()
  const patch: Record<string, unknown> = {}
  if (rowIndex !== undefined) {
    if (byIndex(t)) {
      patch.focusRowIndex = rowIndex
    } else {
      const id = rows.at(rowIndex)?.id
      if (id === undefined) return
      patch.focusRowId = id
    }
  }
  if (columnId !== undefined) patch.focusColumnId = columnId
  t.setCellSelection?.(old =>
    old.length ? [...old.slice(0, -1), { ...old.at(-1)!, ...patch }] : old,
  )
  // Фокус диапазона за экраном — к нему (ADR 0146, §3).
  if (reveal && rowIndex !== undefined) {
    void scrollToRowIndex(t, rowIndex, { align: 'auto' })
  }
}

/** Место фокуса активного диапазона в списке; `-1` — диапазона нет. */
const rangeFocusIndex = (t: NavTable): number => {
  const range = (
    t.store.get().cellSelection as
      { focusRowIndex?: number; focusRowId?: string }[] | undefined
  )?.at(-1)
  if (!range) return -1
  return byIndex(t)
    ? (range.focusRowIndex ?? -1)
    : range.focusRowId === undefined
      ? -1
      : t.getRowSource().indexOf(range.focusRowId)
}

/** Сдвинуть фокус активного диапазона до края таблицы в направлении `direction`. */
const extendSelectionToEdge = (t: NavTable, direction: Direction) => {
  const count = t.getRowSource().count()
  const columnIds = selectableColumnIds(t)
  if (direction === 'up' || direction === 'down') {
    if (count)
      moveRangeFocus(t, { rowIndex: direction === 'up' ? 0 : count - 1 })
    return
  }
  const columnId = direction === 'left' ? columnIds[0] : columnIds.at(-1)
  if (columnId !== undefined) moveRangeFocus(t, { columnId })
}

/** Активная ячейка не якорь диапазона — выделение схлопывается в неё. */
const anchorAt = (t: NavTable, active: ActiveCell) => {
  const columnId = getDisplayColumns(t).ids[active.columnIndex]
  if (!columnId) return
  if (byIndex(t)) {
    const range = (
      t.store.get().cellSelection as
        { anchorRowIndex?: number; anchorColumnId: string }[] | undefined
    )?.at(-1)
    if (
      range?.anchorRowIndex !== active.rowIndex ||
      range.anchorColumnId !== columnId
    ) {
      collapseSelectionTo(t, active)
    }
    return
  }
  const row = t.getRowSource().at(active.rowIndex)
  const focused = t.getFocusedCell?.()
  if (row && (focused?.row.id !== row.id || focused?.column.id !== columnId)) {
    collapseSelectionTo(t, active)
  }
}

const canExtend = (t: NavTable, active: ActiveCell) =>
  isCellSelectionActive(t) &&
  typeof t.extendCellSelection === 'function' &&
  t.options.enableCellRangeSelection !== false &&
  active.rowIndex >= 0 &&
  !isFooterRowIndex(t, active.rowIndex) &&
  active.columnIndex !== ROW_FOCUS_COLUMN

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
  if (!canExtend(t, active)) {
    return false
  }
  anchorAt(t, active)
  if (toEdge) {
    extendSelectionToEdge(t, direction)
  } else {
    t.extendCellSelection!(direction)
  }
  return true
}

/**
 * Shift+PageDown/PageUp — фокус диапазона на экран вниз или вверх, Ctrl+Shift+End/Home —
 * в последнюю или первую ячейку таблицы (ADR 0146, §3). Строки между не загружаются.
 */
const extendSelectionByKey = (
  t: NavTable,
  active: ActiveCell,
  event: NavigationKeyEvent,
  pageRows: number,
): boolean => {
  const ctrl = primaryModifier(event, keyboardPlatformOf(t))
  const page = !ctrl && (event.key === 'PageDown' || event.key === 'PageUp')
  const corner = ctrl && (event.key === 'End' || event.key === 'Home')
  if (!event.shiftKey || event.altKey || (!page && !corner)) {
    return false
  }
  if (!canExtend(t, active)) {
    return false
  }
  anchorAt(t, active)
  const count = t.getRowSource().count()
  if (!count) return true
  if (page) {
    const from = rangeFocusIndex(t)
    const start = from < 0 ? active.rowIndex : from
    const step = event.key === 'PageDown' ? pageRows : -pageRows
    moveRangeFocus(t, {
      rowIndex: Math.min(Math.max(start + step, 0), count - 1),
      reveal: true,
    })
    return true
  }
  const columns = selectableColumnIds(t)
  const end = event.key === 'End'
  moveRangeFocus(t, {
    rowIndex: end ? count - 1 : 0,
    columnId: end ? columns.at(-1) : columns[0],
    reveal: true,
  })
  return true
}

/** Ctrl/Cmd+буква без Shift и Alt — по коду клавиши, а не по букве раскладки. */
const isCtrlCode = (
  event: NavigationKeyEvent,
  code: string,
  platform: KeyboardPlatform,
) =>
  primaryModifier(event, platform) &&
  !event.altKey &&
  !event.shiftKey &&
  event.code === code

/** Ctrl/Cmd+A — по коду клавиши, на любой раскладке (ADR 0220, KC1). */
const isSelectAllKey = (
  event: NavigationKeyEvent,
  platform: KeyboardPlatform,
) => isCtrlCode(event, 'KeyA', platform)

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

/** Вклад выделения ячеек в клавиши навигации. */
export const cellSelectionKeys: NavigationKeys = {
  id: 'cellSelection',
  shortcuts: [
    {
      combo: 'Mod+A',
      section: 'selection',
      label: labels => cellSelectionLabels(labels).selectAllCells,
    },
    {
      combo: 'Mod+C',
      section: 'editing',
      label: labels => cellSelectionLabels(labels).copy,
    },
    {
      combo: 'Mod+X',
      section: 'editing',
      label: labels => cellSelectionLabels(labels).cut,
    },
    {
      combo: 'Mod+V',
      section: 'editing',
      label: labels => cellSelectionLabels(labels).paste,
    },
    {
      combo: 'Mod+D',
      section: 'editing',
      label: labels => cellSelectionLabels(labels).fillDown,
    },
    {
      combo: 'Mod+R',
      section: 'editing',
      label: labels => cellSelectionLabels(labels).fillRight,
    },
  ],
  onKey: (event, { table, active, pageRows }) => {
    const t = table as unknown as NavTable
    const platform = keyboardPlatformOf(table)
    if (isSelectAllKey(event, platform)) return selectAllCellsIn(t)
    // Delete и Backspace очищают выделение (ADR 0219, WR20).
    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      isCellSelectionActive(t) &&
      canPaste(table)
    ) {
      clearSelection(table, 'clear', 'keyboard')
      return true
    }
    // Ctrl/Cmd+D и Ctrl/Cmd+R заполняют вниз и вправо (WR19); закладку и перезагрузку браузер
    // не получает, даже когда заполнять нечем.
    const fillAxis = isCtrlCode(event, 'KeyD', platform)
      ? 'y'
      : isCtrlCode(event, 'KeyR', platform)
        ? 'x'
        : undefined
    if (fillAxis && isCellSelectionActive(t) && canPaste(table)) {
      fillFromEdge(table, fillAxis, 'keyboard')
      return true
    }
    if (extendSelectionByKey(t, active, event, pageRows)) return true
    const direction = ARROW_DIRECTIONS[event.key]
    if (event.shiftKey && !event.altKey && direction) {
      return extendSelectionFrom(
        t,
        active,
        direction,
        primaryModifier(event, platform),
      )
    }
    return false
  },
  onActiveCellChange: (table, next) =>
    collapseSelectionTo(table as unknown as NavTable, next),
}
