/**
 * Активная ячейка серверной модели держит свою строку (ADR 0157, §3): после смены списка она
 * стоит на той же строке по её `id`; строки по `id` нет — индекс сдвигается по журналу вставок и
 * удалений, удалённая строка уступает место соседней. Фокус переходит вслед без прокрутки к строке.
 */
import { pluginStateKey, setPluginState } from '../definePlugin'
import { followIndex, followRowList } from '../rowListFollow'
import { type RowListChange, rowSourceOf } from '../rowSource'
import { trackingOf } from './focus'
import { type ActiveCell, KEYBOARD_NAVIGATION, type NavTable } from './model'

type FollowTable = NavTable & {
  store: { subscribe: (listener: () => void) => { unsubscribe: () => void } }
}

export const followActiveCell = (table: unknown) => {
  const t = table as FollowTable
  const active = () =>
    t.store.get()[pluginStateKey(KEYBOARD_NAVIGATION)] as ActiveCell | undefined
  /**
   * `id` строки активной ячейки до смены списка: журнал не видит строк слоя поверх источника —
   * новая строка, ушедшая из слоя в кэш под тем же `id` (ADR 0181), иначе сдвинула бы ячейку.
   */
  let held: string | undefined
  const shift = (batches: readonly (readonly RowListChange[])[]) => {
    const current = active()!
    const own = held === undefined ? -1 : rowSourceOf(table).indexOf(held)
    const rowIndex = own >= 0 ? own : followIndex(current.rowIndex, batches)
    if (rowIndex === current.rowIndex) return
    const tracking = trackingOf(t)
    if (tracking.within) {
      tracking.pending = true
      tracking.quiet = true
    }
    setPluginState(t, KEYBOARD_NAVIGATION, { ...current, rowIndex })
  }
  const unfollow = followRowList(table, {
    active: () => (active()?.rowIndex ?? -1) >= 0,
    reset: () => {},
    shift,
    newRows: shift,
  })
  // После слежения за списком — запомнить строку ячейки для следующей смены.
  const remember = () => {
    const rowIndex = active()?.rowIndex ?? -1
    held =
      rowIndex >= 0
        ? rowSourceOf<{ id: string }>(table).at(rowIndex)?.id
        : undefined
  }
  remember()
  const subscription = t.store.subscribe(remember)
  return () => {
    unfollow()
    subscription.unsubscribe()
  }
}
