/**
 * Запись плагина keyboardNavigation (ADR 0021) — клавиатурная навигация по ячейкам.
 *
 * Плагин несёт лишь локальный слайс активной ячейки и флаг-опцию
 * `enableKeyboardNavigation`. Роль `grid`, roving tabindex, клавиатурный резолвер,
 * пиновка в виртуализаторе и довод в вид живут в ядровом шве
 * (core/keyboardNavigation.ts) и читают presence по опции — ядро плагин не импортит.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import {
  type ActiveCell,
  followActiveCell,
  INITIAL_ACTIVE_CELL,
  KEYBOARD_NAVIGATION,
} from '../../core/keyboardNavigation'
import type { KeyboardNavigationOptions } from './types'

export const keyboardNavigation = definePlugin<KeyboardNavigationOptions>()({
  id: KEYBOARD_NAVIGATION,
  diagnose: neverInert,
  state: (): ActiveCell => INITIAL_ACTIVE_CELL,
  controlled: { value: 'activeCell', onChange: 'onActiveCellChange' },
  // Активная ячейка серверной модели держит свою строку при смене списка (ADR 0157, §3).
  setup: () => followActiveCell,
  options: o => ({ enableKeyboardNavigation: o.enabled !== false }),
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    keyboardNavigationPlugin: {
      enableKeyboardNavigation?: boolean
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
