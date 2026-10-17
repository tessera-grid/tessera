/**
 * Обработчик клавиш корня грида в режиме навигации (фокус на ячейке): стрелки,
 * действия плагинов, вход в режим действия, Tab-выход, синхронизация с выделением.
 */
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'

import { setPluginState } from '../definePlugin'
import { getDisplayColumns } from '../displayColumns'
import { isFooterInline } from '../footer'
import { keyComboOf, runKeyboardAction } from '../keyboardActions'
import {
  ACTION_KEYS,
  findKeyboardAction,
  getCellWidgets,
  handleActionModeKey,
  isContextMenuKey,
  openContextMenuAt,
  resolveActionTarget,
  resolveRowFocusKey,
  restoreFocusIfLost,
} from './actions'
import {
  collapseSelectionTo,
  extendSelectionFrom,
  isSelectAllKey,
  selectAllCellsIn,
} from './cellSelectionSync'
import { applyFollow, trackingOf } from './focus'
import { getPageRows } from './geometry'
import { skipHeaderSpans } from './header'
import {
  ARROW_DIRECTIONS,
  KEYBOARD_NAVIGATION,
  reportNavigation,
  NAV_BODY_END_ATTR,
  NAV_TARGET_SELECTOR,
  type NavTable,
  ROW_FOCUS_COLUMN,
  getNavRowCount,
  isFooterRowIndex,
  isTreeGrid,
  resolveActive,
} from './model'
import { resolveNavigationKey } from './resolveKey'

interface GridKeyDownContext {
  table: unknown
  getScrollElement: () => HTMLElement | null
  guardBeforeRef: RefObject<HTMLDivElement | null>
  guardAfterRef: RefObject<HTMLDivElement | null>
}

export const handleGridKeyDown = (
  event: ReactKeyboardEvent<HTMLElement>,
  {
    table,
    getScrollElement,
    guardBeforeRef,
    guardAfterRef,
  }: GridKeyDownContext,
) => {
  const target = event.target as HTMLElement
  const cell = target.closest?.<HTMLElement>(NAV_TARGET_SELECTOR)
  if (!cell) {
    return
  }
  if (cell !== target) {
    handleActionModeKey(event, cell, table)
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
      reportNavigation(t, 'moveActiveCell', 'keyboard', () => ({
        from: active,
        to: next,
      }))
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
    reportNavigation(t, 'moveActiveCell', 'keyboard', () => ({
      from: active,
      to: { rowIndex: active.rowIndex, columnIndex: ROW_FOCUS_COLUMN },
    }))
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
    enterActionMode(t, cell)
    return
  }

  if (ACTION_KEYS.has(event.key) && !modified) {
    // Пробел не должен прокручивать контейнер, даже если действия нет.
    event.preventDefault()
    const actionTarget = resolveActionTarget(t, active)
    const action =
      actionTarget && findKeyboardAction(t, actionTarget, event.key)
    if (action && actionTarget) {
      runKeyboardAction(t, action, actionTarget.ctx, event)
      restoreFocusIfLost(cell)
      return
    }
    if (event.key !== ' ' && !event.shiftKey) {
      enterActionMode(t, cell)
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
      runKeyboardAction(t, action, actionTarget.ctx, event)
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

  // Строка за последней строкой тела (ошибка догрузки, ADR 0081) — в порядке экрана:
  // `↓` с последней строки, а под незакреплённым футером — с футера; над закреплённым
  // футером в неё же ведёт `↑` с футера (ADR 0118, §3).
  const lastBodyRow = t.getRowModel().rows.length - 1
  const inlineFooter = isFooterInline(t)
  if (
    !modified &&
    ((event.key === 'ArrowDown' &&
      active.rowIndex === lastBodyRow + (inlineFooter ? 1 : 0)) ||
      (event.key === 'ArrowUp' &&
        !inlineFooter &&
        isFooterRowIndex(t, active.rowIndex)))
  ) {
    const bodyEnd = event.currentTarget.querySelector<HTMLElement>(
      `[${NAV_BODY_END_ATTR}]`,
    )
    if (bodyEnd) {
      event.preventDefault()
      bodyEnd.focus()
      return
    }
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
  const next = skipHeaderSpans(t, active, resolved, modified ? '' : event.key)
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
  reportNavigation(t, 'moveActiveCell', 'keyboard', () => ({
    from: active,
    to: next,
  }))
  setPluginState(t, KEYBOARD_NAVIGATION, next)
}

/** Вход в режим действия — фокус на первый виджет ячейки. */
const enterActionMode = (t: NavTable, cell: HTMLElement) => {
  const widget = getCellWidgets(cell)[0]
  if (!widget) return
  reportNavigation(t, 'enterActionMode', 'keyboard')
  widget.focus()
}
