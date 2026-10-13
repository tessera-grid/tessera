/**
 * Модель кнопок «наверх» и «к первой колонке» (ADR 0082, ADR 0105): пересечение порога
 * прокрутки по оси, прокрутка к краю и перенос активной ячейки клавиатурной навигации.
 */
import { pluginStateKey, setPluginState } from '../../core/definePlugin'
import {
  type ActiveCell,
  KEYBOARD_NAVIGATION,
  isKeyboardNavigationEnabled,
} from '../../core/keyboardNavigation/model'
import type { PluginDiagnose } from '../../core/pluginDiagnostics'
import { scrollGridTo } from '../../core/scrollGridTo'

export const BACK_TO_TOP = 'backToTop'

/** Порог по умолчанию — две высоты (две ширины) области прокрутки. */
const DEFAULT_SCREENS = 2

export const backToTopInertReason: PluginDiagnose = table =>
  (table as { options: { enableStatusBar?: boolean } }).options
    .enableStatusBar === false
    ? 'noStatusBar'
    : undefined

/** Ось кнопки: «наверх» — вертикаль, «к первой колонке» — горизонталь. */
export type EdgeAxis = 'vertical' | 'horizontal'

export interface ScrollArea {
  scrollTop: number
  clientHeight: number
  scrollLeft?: number
  clientWidth?: number
  addEventListener: (
    type: 'scroll',
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void
  removeEventListener: (type: 'scroll', listener: () => void) => void
}

export const isPastThreshold = (
  area: ScrollArea,
  threshold?: number,
  axis: EdgeAxis = 'vertical',
) => {
  const offset = axis === 'vertical' ? area.scrollTop : (area.scrollLeft ?? 0)
  const size = axis === 'vertical' ? area.clientHeight : (area.clientWidth ?? 0)
  return offset > 0 && offset >= (threshold ?? size * DEFAULT_SCREENS)
}

/**
 * Следит, прокручена ли область за порог; `onChange` — сразу и затем только при
 * пересечении порога, а не на каждое событие прокрутки (BT12). Возвращает отписку.
 */
export const watchThreshold = (
  area: ScrollArea,
  threshold: number | undefined,
  onChange: (past: boolean) => void,
  axis: EdgeAxis = 'vertical',
): (() => void) => {
  let past = isPastThreshold(area, threshold, axis)
  onChange(past)
  const check = () => {
    const next = isPastThreshold(area, threshold, axis)
    if (next !== past) {
      past = next
      onChange(next)
    }
  }
  area.addEventListener('scroll', check, { passive: true })
  return () => area.removeEventListener('scroll', check)
}

/** Область прокрутки грида, в чьей нижней панели стоит элемент. */
export const findGridScroller = (element: Element | null) =>
  element
    ?.closest('[data-status-bar]')
    ?.querySelector<HTMLElement>(':scope > .data-grid__container') ?? null

interface JumpTable {
  store: { get: () => Record<string, unknown> }
  getRowModel: () => { rows: unknown[] }
}

/**
 * К первой строке: прыжок на экран от верха и плавно последний экран, быстрая
 * прокрутка не включается — строки приходят с содержимым (BT16, BT6). Активная ячейка
 * тела — в первую строку той же колонки, фокус не трогается (BT9).
 */
export const scrollToTop = (table: unknown, scroller: HTMLElement) => {
  scrollGridTo(scroller, { top: 0 }, 'smooth')
  if (!isKeyboardNavigationEnabled(table)) {
    return
  }
  const t = table as JumpTable
  const active = t.store.get()[pluginStateKey(KEYBOARD_NAVIGATION)] as
    ActiveCell | undefined
  // Шапка и футер (строка за последней строкой тела) от прокрутки не зависят.
  if (
    !active ||
    active.rowIndex <= 0 ||
    active.rowIndex >= t.getRowModel().rows.length
  ) {
    return
  }
  setPluginState(table, KEYBOARD_NAVIGATION, { ...active, rowIndex: 0 })
}

/**
 * К первой колонке (BT19–BT20): та же схема по горизонтали, вертикаль не меняется.
 * Активная ячейка — в первую колонку той же строки, фокус не трогается.
 */
export const scrollToStart = (table: unknown, scroller: HTMLElement) => {
  scrollGridTo(scroller, { left: 0 }, 'smooth')
  if (!isKeyboardNavigationEnabled(table)) {
    return
  }
  const active = (table as JumpTable).store.get()[
    pluginStateKey(KEYBOARD_NAVIGATION)
  ] as ActiveCell | undefined
  if (!active || active.columnIndex <= 0) {
    return
  }
  setPluginState(table, KEYBOARD_NAVIGATION, { ...active, columnIndex: 0 })
}

/** Прокручивается ли область по горизонтали — есть ли куда возвращаться. */
export const scrollsHorizontally = (area: HTMLElement) =>
  area.scrollWidth > area.clientWidth
