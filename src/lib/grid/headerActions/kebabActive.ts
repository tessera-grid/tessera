import type { SlotAction } from '../../core/headerActions'

/**
 * Включён ли кебаб (ADR 0129): `undefined` — среди свёрнутых нет действий с `active`, и
 * узла бабла у кнопки нет.
 */
export const kebabActive = (actions: SlotAction[], activeCount: number) =>
  actions.some(action => action.active) ? activeCount > 0 : undefined
