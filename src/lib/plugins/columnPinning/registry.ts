/**
 * Запись плагина columnPinning на `definePlugin`. Поведение даёт встроенный
 * `columnPinningFeature` (state {start,end}).
 *  - гранулярность под вложенной шапкой — в `visible` дескриптора (нет опции
 *    per-column canPin);
 *  - `enableLeafPinning` (opt-in reorder-out) — доп. табличная опция.
 */
import { columnPinningFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { narrowLeafPinning } from './narrowPinning'
import { pinHeaderAction } from './pinHeaderAction'
import type { ColumnPinningHooks } from './types'

export interface ColumnPinningOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Режим reorder-out: закрепление любой единицы под вложенной шапкой. */
  leafPinning?: boolean
  /** Бизнес-колбэк закрепления (аргумент фабрики); читается живо. */
  onTogglePin?: ColumnPinningHooks['onTogglePin']
}

export const columnPinning = definePlugin<ColumnPinningOptions>()({
  id: 'columnPinning',
  diagnose: neverInert,
  features: { columnPinningFeature },
  hooks: o => ({ onTogglePin: o.onTogglePin }),
  // Единый дескриптор: ядро решает подачу (инлайн/кебаб).
  slotActions: [pinHeaderAction],
  narrow: o =>
    o.enabled === false || o.leafPinning
      ? undefined
      : { columnPinning: narrowLeafPinning },
  options: o => ({
    enableColumnPinning: o.enabled !== false,
    enableLeafPinning: !!o.leafPinning,
  }),
})
