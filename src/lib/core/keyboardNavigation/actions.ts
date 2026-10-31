/** Режим действия: виджеты ячейки, действия плагинов, фокус на строке treegrid. */
import { reportNavigation } from './model'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import { type KeyboardAction, runKeyboardAction } from '../keyboardActions'
import { getHeaderOwner } from './header'
import { type ActiveCell, type NavTable, ROW_FOCUS_COLUMN } from './model'

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
export const getCellWidgets = (cell: HTMLElement): HTMLElement[] =>
  Array.from(cell.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    widget => widget.getClientRects().length > 0,
  )

export const isFocusLost = () =>
  document.activeElement === null || document.activeElement === document.body

/**
 * Вернуть фокус на ячейку, если сфокусированный виджет исчез из DOM (редактор
 * закрылся после коммита, меню размонтировалось). Проверка — после ре-рендера.
 */
export const restoreFocusIfLost = (cell: HTMLElement) => {
  setTimeout(() => {
    if (isFocusLost() && cell.isConnected) {
      cell.focus({ preventScroll: true })
    }
  }, 0)
}

export const ACTION_KEYS = new Set([' ', 'Enter', 'F2'])

/** `Ctrl+Shift+Enter` — замена `Shift+F10` для клавиатур без F-ряда (KB14). */
export const isContextMenuKey = (event: ReactKeyboardEvent<HTMLElement>) =>
  event.key === 'ContextMenu' ||
  (event.key === 'F10' && event.shiftKey) ||
  (event.key === 'Enter' &&
    event.shiftKey &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey)

/** Контекст активной ячейки для канала `keyboardActions`. */
export const resolveActionTarget = (
  t: NavTable,
  active: ActiveCell,
): { scope: KeyboardAction['scope']; ctx: unknown } | null => {
  if (active.rowIndex < 0) {
    const header = getHeaderOwner(t, active.rowIndex, active.columnIndex)
    return header ? { scope: 'header', ctx: header.getContext() } : null
  }
  const cell = t.getRowSource().at(active.rowIndex)?.getVisibleCells()[
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
  const row = t.getRowSource().at(rowIndex)
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
      runKeyboardAction(t, action, ctx, event)
      return true
    }
  }
  return false
}

/**
 * Клавиши в режиме фокуса на строке treegrid (паттерн APG Treegrid): следующая
 * активная позиция, `'handled'` — клавиша обработана на месте, `null` — не наша.
 */
export const resolveRowFocusKey = (
  t: NavTable,
  active: ActiveCell,
  event: ReactKeyboardEvent<HTMLElement>,
): ActiveCell | 'handled' | null => {
  const rows = t.getRowSource()
  const row = rows.at(active.rowIndex)
  const atRow = (rowIndex: number): ActiveCell => ({
    rowIndex: Math.min(Math.max(rowIndex, 0), rows.count() - 1),
    columnIndex: ROW_FOCUS_COLUMN,
  })
  switch (event.key) {
    // Без переключателя (дерево `rowExpandingModel`, ADR 0119) стрелки только двигают фокус.
    case 'ArrowRight':
      if (
        row?.getCanExpand?.() &&
        !row.getIsExpanded?.() &&
        toggleRowExpansion(t, active.rowIndex, event)
      ) {
        return 'handled'
      }
      return { rowIndex: active.rowIndex, columnIndex: 0 }
    case 'ArrowLeft': {
      if (
        row?.getIsExpanded?.() &&
        toggleRowExpansion(t, active.rowIndex, event)
      ) {
        return 'handled'
      }
      const parent =
        row?.parentId === undefined ? -1 : rows.indexOf(row.parentId)
      return parent === -1 ? 'handled' : atRow(parent)
    }
    case 'ArrowUp':
      return atRow(active.rowIndex - 1)
    case 'ArrowDown':
      return atRow(active.rowIndex + 1)
    case 'Home':
      return atRow(0)
    case 'End':
      return atRow(rows.count() - 1)
    default:
      return null
  }
}

/** Применимое действие плагина для клавиши; канал уже упорядочен по `priority`. */
export const findKeyboardAction = (
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

export const handleActionModeKey = (
  event: ReactKeyboardEvent<HTMLElement>,
  cell: HTMLElement,
  table?: unknown,
) => {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    // Escape во всплывающем окне виджета (меню, диалог) закрывает его само и
    // возвращает фокус на кнопку-триггер; на ячейку — следующий Escape.
    if ((event.target as HTMLElement).closest?.(POPUP_SELECTOR)) {
      return
    }
    event.preventDefault()
    reportNavigation(table, 'exitActionMode', 'keyboard')
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

/** Событие `contextmenu` в центре ячейки; `true` — его обработали (меню открыто). */
export const openContextMenuAt = (cell: HTMLElement): boolean => {
  const rect = cell.getBoundingClientRect()
  return !cell.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }),
  )
}
