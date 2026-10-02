/**
 * Раскладка кнопок тулбара по подгруппам (ADR 0035, TB9): кнопки группируются по
 * `group`, группы идут по наименьшему `order` среди своих кнопок, кнопки внутри —
 * по `order`. Без `order` (или `'last'`) — в конец, в порядке регистрации.
 * Стороны (`align`): `'start'` — слева (поле поиска), по умолчанию `'end'` — справа.
 */
import type { ToolbarSlot } from './createSlots'

export const DEFAULT_TOOLBAR_GROUP = 'default'

export interface ToolbarGroup {
  id: string
  items: ToolbarSlot
}

const orderOf = (order: number | 'last' | undefined) =>
  typeof order === 'number' ? order : Number.POSITIVE_INFINITY

export const resolveToolbarGroups = (slot: ToolbarSlot): ToolbarGroup[] => {
  const sorted = [...slot].sort((a, b) => orderOf(a.order) - orderOf(b.order))

  const groups = new Map<string, ToolbarSlot>()
  for (const item of sorted) {
    const id = item.group ?? DEFAULT_TOOLBAR_GROUP
    groups.set(id, [...(groups.get(id) ?? []), item])
  }

  return [...groups].map(([id, items]) => ({ id, items }))
}

export interface ToolbarSides {
  start: ToolbarGroup[]
  end: ToolbarGroup[]
}

export const resolveToolbarSides = (slot: ToolbarSlot): ToolbarSides => ({
  start: resolveToolbarGroups(slot.filter(item => item.align === 'start')),
  end: resolveToolbarGroups(slot.filter(item => item.align !== 'start')),
})
