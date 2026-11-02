/**
 * Слот кебаба, где открыт раздел меню (ADR 0079): у пунктов раздела своего слота нет, а цель
 * по умолчанию — объект этого слота (ADR 0177, §1). Пункт не копируется: кэши дескрипторов
 * держатся за объект.
 */
import type { MenuAction } from './types'

const sectionSlots = new WeakMap<MenuAction, unknown>()

/** Запомнить слот владельца раздела у его пунктов. */
export const rememberSectionSlot = (
  owner: MenuAction,
  items: readonly MenuAction[],
) => {
  const slot = (owner as { slot?: unknown }).slot ?? sectionSlots.get(owner)
  if (slot === undefined) return
  for (const item of items) sectionSlots.set(item, slot)
}

/** Слот действия: свой или унаследованный от раздела. */
export const slotOfAction = (action: MenuAction) =>
  (action as { slot?: unknown }).slot ?? sectionSlots.get(action)
