/**
 * Активная ячейка серверной модели держит свою строку (ADR 0157, §3): строки выше вставлены
 * или удалены — её индекс сдвигается, строка удалена — ячейка переходит к соседней. Фокус
 * переходит вслед без прокрутки к строке.
 */
import { pluginStateKey, setPluginState } from '../definePlugin'
import { followIndex, followRowList } from '../rowListFollow'
import { trackingOf } from './focus'
import { type ActiveCell, KEYBOARD_NAVIGATION, type NavTable } from './model'

export const followActiveCell = (table: unknown) => {
  const t = table as NavTable
  const active = () =>
    t.store.get()[pluginStateKey(KEYBOARD_NAVIGATION)] as ActiveCell | undefined
  return followRowList(table, {
    active: () => (active()?.rowIndex ?? -1) >= 0,
    reset: () => {},
    shift: batches => {
      const current = active()!
      const rowIndex = followIndex(current.rowIndex, batches)
      if (rowIndex === current.rowIndex) return
      const tracking = trackingOf(t)
      if (tracking.within) {
        tracking.pending = true
        tracking.quiet = true
      }
      setPluginState(t, KEYBOARD_NAVIGATION, { ...current, rowIndex })
    },
  })
}
