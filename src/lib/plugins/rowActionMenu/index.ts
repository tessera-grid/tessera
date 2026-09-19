/**
 * Плагин схлопывания действий СТРОКИ (`actionRowSlot`) в кебаб-меню (ADR 0024).
 * Как headerActionMenu — только декларация `actionMenu`.
 */
import type { ActionMenuDeclaration } from '../../core/headerActions'
import type { TesseraFeatureEntry } from '../../core/features'

export interface RowActionMenuOptions {
  enabled?: boolean
  /** `auto` — по порогу; `always` — всегда. По умолчанию `auto`. */
  mode?: 'auto' | 'always'
  /** Порог схлопывания для `auto` (по умолчанию 2 — агрессивнее заголовков). */
  threshold?: number
}

export const rowActionMenu = (opts: RowActionMenuOptions = {}) =>
  ({
    id: 'rowActionMenu',
    enabled: opts.enabled,
    slot: {},
    actionMenu: {
      mode: opts.mode ?? 'auto',
      threshold: opts.threshold ?? 2,
      slots: ['actionRowSlot'],
    } satisfies ActionMenuDeclaration,
  }) satisfies TesseraFeatureEntry
