/**
 * Раскладка кнопок тулбара по подгруппам (ADR 0035, TB9; ADR 0051): кнопки
 * группируются по `group`; встроенные группы идут по рангу, остальные — после них,
 * по наименьшему `order` среди своих кнопок; кнопки внутри — по `order`. Без
 * `order` (или `'last'`) — в конец, в порядке регистрации.
 * Стороны (`align`): `'start'` — слева (поиск и сводка фильтров), по умолчанию
 * `'end'` — справа.
 */
import type { ToolbarSlot } from './createSlots'

export const DEFAULT_TOOLBAR_GROUP = 'default'

/** Button position in the toolbar: overrides its slot's group, order and side (ADR 0205). */
export interface ToolbarPlacement {
  /** Button group: built-in or the application's own. */
  group?: string
  /** Order within the group. */
  order?: number | 'last'
  /** Toolbar side. */
  align?: 'start' | 'end'
}

/** Ранги встроенных групп: порядок не зависит от порядка плагинов (TB16). */
const BUILTIN_GROUP_RANK: Record<string, number> = {
  search: 0,
  view: 1,
  data: 2,
  // Пульт черновиков — после групп потребителя, перед журналом отказов (ADR 0178, §8).
  // Отмена, повтор и история — перед пультом черновиков (ADR 0222, §11).
  history: Number.MAX_SAFE_INTEGER - 1,
  drafts: Number.MAX_SAFE_INTEGER,
  // Журнал отказов — последним справа, после групп потребителя (ADR 0177, §7).
  failures: Number.POSITIVE_INFINITY,
}

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

  const rankOf = (id: string) =>
    BUILTIN_GROUP_RANK[id] ?? Number.MAX_SAFE_INTEGER

  // Map хранит порядок по наименьшему `order`; стабильная сортировка по рангу его сохраняет.
  return [...groups]
    .sort(([a], [b]) => rankOf(a) - rankOf(b))
    .map(([id, items]) => ({ id, items }))
}

export interface ToolbarSides {
  start: ToolbarGroup[]
  end: ToolbarGroup[]
}

export const resolveToolbarSides = (slot: ToolbarSlot): ToolbarSides => ({
  start: resolveToolbarGroups(slot.filter(item => item.align === 'start')),
  end: resolveToolbarGroups(slot.filter(item => item.align !== 'start')),
})
