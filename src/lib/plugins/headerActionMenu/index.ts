/**
 * Фаза E — плагин схлопывания кнопок заголовка в кебаб-меню (v9-порт, ADR 0024).
 * Не вносит фичи/слота — лишь объявляет `actionMenu` для слотов заголовка; зона
 * действий грида решает подачу (инлайн/кебаб) поверх дескрипторов SlotAction.
 */
import type {
  ActionMenuDeclaration,
  HeaderActionSlot,
} from '../../core/headerActions'
import type { TesseraFeatureEntry } from '../../core/features'

export interface HeaderActionMenuOptions {
  enabled?: boolean
  /** `auto` — по порогу; `always` — всегда. По умолчанию `auto`. */
  mode?: 'auto' | 'always'
  /** Порог схлопывания для `auto` (по умолчанию 3). */
  threshold?: number
  /** Слоты заголовка (по умолчанию `['rightHeaderSlot']`). */
  slots?: HeaderActionSlot[]
}

export const headerActionMenu = (opts: HeaderActionMenuOptions = {}) =>
  ({
    id: 'headerActionMenu',
    enabled: opts.enabled,
    slot: {},
    actionMenu: {
      mode: opts.mode ?? 'auto',
      threshold: opts.threshold ?? 3,
      slots: opts.slots ?? ['rightHeaderSlot'],
    } satisfies ActionMenuDeclaration,
  }) satisfies TesseraFeatureEntry
