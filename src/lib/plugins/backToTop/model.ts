/**
 * Модель кнопки «наверх» (ADR 0082): пересечение порога прокрутки, мгновенный
 * прыжок к первой строке и перенос активной ячейки клавиатурной навигации.
 */
import { pluginStateKey, setPluginState } from '../../core/definePlugin'
import {
  type ActiveCell,
  KEYBOARD_NAVIGATION,
  isKeyboardNavigationEnabled,
} from '../../core/keyboardNavigation/model'
import type { PluginDiagnose } from '../../core/pluginDiagnostics'

export const BACK_TO_TOP = 'backToTop'

/** Порог по умолчанию — две высоты области прокрутки. */
const DEFAULT_SCREENS = 2

export const backToTopInertReason: PluginDiagnose = table =>
  (table as { options: { enableStatusBar?: boolean } }).options
    .enableStatusBar === false
    ? 'noStatusBar'
    : undefined

export interface ScrollArea {
  scrollTop: number
  clientHeight: number
  addEventListener: (
    type: 'scroll',
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void
  removeEventListener: (type: 'scroll', listener: () => void) => void
}

export const isPastThreshold = (area: ScrollArea, threshold?: number) =>
  area.scrollTop > 0 &&
  area.scrollTop >= (threshold ?? area.clientHeight * DEFAULT_SCREENS)

/**
 * Следит, прокручена ли область за порог; `onChange` — сразу и затем только при
 * пересечении порога, а не на каждое событие прокрутки (BT12). Возвращает отписку.
 */
export const watchThreshold = (
  area: ScrollArea,
  threshold: number | undefined,
  onChange: (past: boolean) => void,
): (() => void) => {
  let past = isPastThreshold(area, threshold)
  onChange(past)
  const check = () => {
    const next = isPastThreshold(area, threshold)
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
 * Прыжок к первой строке за один кадр (BT5); строки на новом месте монтируются до
 * входа в быструю прокрутку и приходят с содержимым (BT6). Активная
 * ячейка тела — в первую строку той же колонки, фокус не трогается (BT9).
 */
export const jumpToTop = (table: unknown, scroller: HTMLElement) => {
  scroller.scrollTo({ top: 0, behavior: 'instant' })
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
