/**
 * Раскладка нижней панели по сторонам (ADR 0038, SB4): слоты делятся по `align`
 * (по умолчанию `'start'`), внутри стороны — по `order`. Без `order` (или
 * `'last'`) — в конец, в порядке регистрации.
 */
import type { StatusBarSlot } from './createSlots'

export interface StatusBarSides {
  start: StatusBarSlot
  end: StatusBarSlot
}

const orderOf = (order: number | 'last' | undefined) =>
  typeof order === 'number' ? order : Number.POSITIVE_INFINITY

export const resolveStatusBarSides = (slot: StatusBarSlot): StatusBarSides => {
  const sorted = [...slot].sort((a, b) => orderOf(a.order) - orderOf(b.order))
  return {
    start: sorted.filter(item => (item.align ?? 'start') === 'start'),
    end: sorted.filter(item => item.align === 'end'),
  }
}
