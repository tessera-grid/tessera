/**
 * Плагин схлопывания кнопок заголовка в кебаб-меню (ADR 0024) на `definePlugin`. Не
 * вносит фичи/слота — лишь объявляет `actionMenu` для слотов заголовка; зона действий
 * грида решает подачу (инлайн/кебаб) поверх дескрипторов SlotAction.
 */
import { definePlugin } from '../../core/definePlugin'
import type { HeaderActionSlot } from '../../core/headerActions'

export interface HeaderActionMenuOptions {
  enabled?: boolean
  /** `auto` — по порогу; `always` — всегда. По умолчанию `auto`. */
  mode?: 'auto' | 'always'
  /** Порог схлопывания для `auto` (по умолчанию 3). */
  threshold?: number
  /** Слоты заголовка (по умолчанию `['rightHeaderSlot']`). */
  slots?: HeaderActionSlot[]
}

export const headerActionMenu = definePlugin<HeaderActionMenuOptions>()({
  id: 'headerActionMenu',
  features: {},
  actionMenu: o => ({
    mode: o.mode ?? 'auto',
    threshold: o.threshold ?? 3,
    slots: o.slots ?? ['rightHeaderSlot'],
  }),
})
