/**
 * Плагин схлопывания действий СТРОКИ (`actionRowSlot`) в кебаб-меню на
 * `definePlugin`. Как headerActionMenu — только декларация `actionMenu`.
 */
import { definePlugin } from '../../core/definePlugin'
import { noSlotActionsReason } from '../../core/pluginDiagnostics'

export interface RowActionMenuOptions {
  enabled?: boolean
  /** `auto` — by threshold; `always` — always. `auto` by default. */
  mode?: 'auto' | 'always'
  /** Collapse threshold for `auto` (2 by default — more aggressive than headers). */
  threshold?: number
}

export const DEFAULT_ROW_ACTION_MENU = {
  mode: 'auto',
  threshold: 2,
} as const satisfies RowActionMenuOptions

export const rowActionMenu = definePlugin<RowActionMenuOptions>()({
  id: 'rowActionMenu',
  diagnose: table => noSlotActionsReason(table, ['actionRowSlot']),
  features: {},
  actionMenu: o => ({
    mode: o.mode ?? DEFAULT_ROW_ACTION_MENU.mode,
    threshold: o.threshold ?? DEFAULT_ROW_ACTION_MENU.threshold,
    slots: ['actionRowSlot'],
  }),
})
