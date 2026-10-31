/**
 * Запись ядра клавиатурной навигации (ADR 0170, §1): срез активной ячейки и его опции
 * `activeCell`, `onActiveCellChange` и `initialActiveCell` (ADR 0171, §4). Включает навигацию опция ядра
 * `enableKeyboardNavigation`; запись есть в каждой таблице и плагином не считается.
 */
import { definePlugin } from '../definePlugin'
import type { TesseraFeatureEntry } from '../features'
import { neverInert } from '../pluginDiagnostics'
import { followActiveCell } from './followActiveCell'
import {
  type ActiveCell,
  INITIAL_ACTIVE_CELL,
  KEYBOARD_NAVIGATION,
} from './model'

interface ActiveCellOptions {
  enabled?: boolean
  activeCell?: ActiveCell
  onActiveCellChange?: (next: ActiveCell) => void
  initialActiveCell?: ActiveCell
}

const activeCellEntry = definePlugin<ActiveCellOptions>()({
  id: KEYBOARD_NAVIGATION,
  diagnose: neverInert,
  state: (): ActiveCell => INITIAL_ACTIVE_CELL,
  stateName: 'activeCell',
  // Активная ячейка серверной модели держит свою строку при смене списка (ADR 0157, §3).
  setup: () => followActiveCell,
})

/** Запись ядра в начале набора: в диагностике плагинов её нет. */
export const keyboardNavigationEntry = (
  options: Omit<ActiveCellOptions, 'enabled'>,
): TesseraFeatureEntry => ({
  ...activeCellEntry(options),
  includedBy: 'core',
})
