/**
 * Запись ядра клавиатурной навигации (ADR 0170, §1): срез активной ячейки и её связь с
 * опциями `activeCell` и `onActiveCellChange`. Включает навигацию опция ядра
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
}

const activeCellEntry = definePlugin<ActiveCellOptions>()({
  id: KEYBOARD_NAVIGATION,
  diagnose: neverInert,
  state: (): ActiveCell => INITIAL_ACTIVE_CELL,
  controlled: { value: 'activeCell', onChange: 'onActiveCellChange' },
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
