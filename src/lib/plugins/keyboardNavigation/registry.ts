/**
 * Запись плагина keyboardNavigation (ADR 0021) — клавиатурная навигация по ячейкам.
 *
 * Плагин несёт лишь локальный слайс активной ячейки и флаг-опцию
 * `enableKeyboardNavigation`. Роль `grid`, roving tabindex, клавиатурный резолвер,
 * пиновка в виртуализаторе и довод в вид живут в ядровом шве
 * (core/keyboardNavigation.ts) и читают presence по опции — ядро плагин не импортит.
 */
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import {
  type ActiveCell,
  INITIAL_ACTIVE_CELL,
  KEYBOARD_NAVIGATION,
} from '../../core/keyboardNavigation'
import type { KeyboardNavigationOptions } from './types'

export const keyboardNavigation = definePlugin<KeyboardNavigationOptions>()({
  id: KEYBOARD_NAVIGATION,
  diagnose: neverInert,
  state: (): ActiveCell => INITIAL_ACTIVE_CELL,
  controlled: { value: 'activeCell', onChange: 'onActiveCellChange' },
  options: o => ({ enableKeyboardNavigation: o.enabled !== false }),
})
