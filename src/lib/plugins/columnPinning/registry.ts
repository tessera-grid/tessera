/**
 * Запись плагина columnPinning (ADR 0011) на `definePlugin`. Поведение даёт встроенный
 * `columnPinningFeature` (state {start,end}).
 *  - гранулярность под вложенной шапкой — в `visible` дескриптора (нет опции
 *    per-column canPin);
 *  - `enableLeafPinning` (opt-in reorder-out, ADR 0011) — доп. табличная опция.
 */
import { columnPinningFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { pinHeaderAction } from './pinHeaderAction'
import type { ColumnPinningPluginParams } from './types'

export interface ColumnPinningOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Режим reorder-out: закрепление любой единицы под вложенной шапкой (ADR 0011). */
  leafPinning?: boolean
  /** Бизнес-колбэк закрепления (аргумент фабрики, ADR 0027); читается живо. */
  onTogglePin?: ColumnPinningPluginParams['onTogglePin']
}

export const columnPinning = definePlugin<ColumnPinningOptions>()({
  id: 'columnPinning',
  features: { columnPinningFeature },
  hooks: o => ({ onTogglePin: o.onTogglePin }),
  // Единый дескриптор (ADR 0011/0024): ядро решает подачу (инлайн/кебаб).
  slotActions: [pinHeaderAction],
  options: o => ({
    enableColumnPinning: o.enabled !== false,
    enableLeafPinning: !!o.leafPinning,
  }),
})
