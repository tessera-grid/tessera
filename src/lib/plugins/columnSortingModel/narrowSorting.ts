/**
 * Эффективная сортировка при `multiSort` (ADR 0039, RX9): без мультисортировки —
 * первая, с `max` — первые N по приоритету; сохранённый срез `sorting` не меняется.
 */
import type { SortingState } from '@tanstack/react-table'

import type { NarrowState } from '../../core/definePlugin'

export const narrowSorting =
  (limit: number): NarrowState =>
  (value: SortingState) =>
    value.length > limit ? value.slice(0, limit) : value
