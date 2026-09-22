/**
 * Плагин схлопывания действий СТРОКИ (`actionRowSlot`) в кебаб-меню на
 * `definePlugin`. Как headerActionMenu — только декларация `actionMenu`.
 */
import { definePlugin } from '../../core/definePlugin'

export interface RowActionMenuOptions {
  enabled?: boolean
  /** `auto` — по порогу; `always` — всегда. По умолчанию `auto`. */
  mode?: 'auto' | 'always'
  /** Порог схлопывания для `auto` (по умолчанию 2 — агрессивнее заголовков). */
  threshold?: number
}

export const rowActionMenu = definePlugin<RowActionMenuOptions>()({
  id: 'rowActionMenu',
  features: {},
  actionMenu: o => ({
    mode: o.mode ?? 'auto',
    threshold: o.threshold ?? 2,
    slots: ['actionRowSlot'],
  }),
})
