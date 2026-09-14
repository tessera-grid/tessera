/**
 * Фаза E — запись плагина columnPinning для v9 (порт registry.ts, ADR 0011).
 *
 * Отличия от v8:
 *  - поведение даёт встроенный `columnPinningFeature` (state {start,end});
 *  - гранулярность под вложенной шапкой перенесена в `visible` дескриптора
 *    (в v9 нет опции per-column canPin), поэтому обёртка getCanPin в createColumn и
 *    `keepFeatureWhenDisabled` больше не нужны;
 *  - `enableLeafPinning` (opt-in reorder-out, ADR 0011) — доп. табличная опция.
 */
import { columnPinningFeature } from '@tanstack/react-table'

import type { TesseraFeatureEntry } from '../../core/features'
import { pinHeaderAction } from './pinHeaderAction'

export interface ColumnPinningOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Режим reorder-out: закрепление любой единицы под вложенной шапкой (ADR 0011). */
  leafPinning?: boolean
}

export const columnPinning = (opts: ColumnPinningOptions = {}) =>
  ({
    id: 'columnPinning',
    enabled: opts.enabled,
    slot: {
      columnPinningFeature,
    },
    // Единый дескриптор (ADR 0011/0024): ядро решает подачу (инлайн/кебаб).
    slotActions: [pinHeaderAction],
    options: {
      enableColumnPinning: opts.enabled !== false,
      enableLeafPinning: !!opts.leafPinning,
    },
  }) satisfies TesseraFeatureEntry<{
    columnPinningFeature: typeof columnPinningFeature
  }>
