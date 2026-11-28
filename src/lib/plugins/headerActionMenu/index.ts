/**
 * Плагин схлопывания кнопок заголовка в кебаб-меню на `definePlugin`. Не
 * вносит фичи/слота — лишь объявляет `actionMenu` для слотов заголовка; зона действий
 * грида решает подачу (инлайн/кебаб) поверх дескрипторов SlotAction.
 */
import { definePlugin } from '../../core/definePlugin'
import type { HeaderActionSlot } from '../../core/headerActions'
import { menuSlotsOf, noSlotActionsReason } from '../../core/pluginDiagnostics'

export interface HeaderActionMenuOptions {
  enabled?: boolean
  /** `auto` — by threshold; `always` — always. `auto` by default. */
  mode?: 'auto' | 'always'
  /** Collapse threshold for `auto` (3 by default). */
  threshold?: number
  /** Header slots (`['rightHeaderSlot']` by default). */
  slots?: HeaderActionSlot[]
}

export const DEFAULT_HEADER_ACTION_MENU = {
  mode: 'auto',
  threshold: 3,
} as const satisfies HeaderActionMenuOptions

export const headerActionMenu = definePlugin<HeaderActionMenuOptions>()({
  id: 'headerActionMenu',
  diagnose: table =>
    noSlotActionsReason(
      table,
      menuSlotsOf(table, ['leftHeaderSlot', 'rightHeaderSlot']),
    ),
  features: {},
  actionMenu: o => ({
    mode: o.mode ?? DEFAULT_HEADER_ACTION_MENU.mode,
    threshold: o.threshold ?? DEFAULT_HEADER_ACTION_MENU.threshold,
    slots: o.slots ?? ['rightHeaderSlot'],
  }),
})
