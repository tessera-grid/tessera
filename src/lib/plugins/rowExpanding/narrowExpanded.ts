/**
 * Эффективное раскрытие (ADR 0039, RX8; ADR 0054, §5): строки глубже `maxDepth` и
 * ленивые строки без ответа и без ожидания показаны свёрнутыми, сохранённый срез
 * `expanded` не меняется. При активной группировке раскрытием владеет rowGrouping —
 * сужения нет.
 */
import type { ExpandedState } from '@tanstack/react-table'

import type { NarrowState } from '../../core/definePlugin'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import type { Row } from '../../types'
import type { RowExpandPending } from './rowExpandingPendingFeature'
import { isLazyRow } from './toggleRowExpanded'
import type { RowExpandingHooks } from './types'

interface NarrowRow {
  id: string
  depth: number
  subRows: unknown[]
}

interface NarrowTable {
  atoms: {
    grouping?: { get: () => unknown[] }
    rowExpandPending?: { get: () => RowExpandPending }
  }
  getCoreRowModel: () => {
    flatRows: NarrowRow[]
    rowsById: Record<string, NarrowRow | undefined>
  }
}

export const narrowExpanded =
  (
    maxDepth: number,
    hasChildren: RowExpandingHooks['hasChildren'],
  ): NarrowState =>
  (value: ExpandedState, table: NarrowTable | null) => {
    if (!table) {
      return undefined
    }
    if ((table.atoms.grouping?.get() ?? []).length > 0) {
      return value
    }
    // Серверная модель строк: «раскрыть всё» раскрывает строки окна по мере прихода
    // (ADR 0160, §1) — сужать нечего.
    if (serverRowModelReason(table)) return value
    const { flatRows, rowsById } = table.getCoreRowModel()
    const pending = table.atoms.rowExpandPending?.get() ?? {}
    // Ленивая строка без детей (ответа ещё нет) и без ожидания раскрытой не видна.
    const unloaded = (row: NarrowRow) =>
      !!hasChildren &&
      row.subRows.length === 0 &&
      !pending[row.id] &&
      isLazyRow(row as unknown as Row<any, any>, hasChildren)
    const allowed = (row: NarrowRow | undefined) =>
      !row || (row.depth < maxDepth && !unloaded(row))

    if (value === true) {
      const hidden = flatRows.some(
        row =>
          (row.subRows.length > 0 && row.depth >= maxDepth) ||
          (row.depth < maxDepth && unloaded(row)),
      )
      if (!hidden) {
        return value
      }
      return Object.fromEntries(
        flatRows
          .filter(row => row.subRows.length > 0 && row.depth < maxDepth)
          .map(row => [row.id, true]),
      )
    }
    // Неизвестная строка (группа, новые данные) остаётся как есть.
    const kept = Object.entries(value).filter(([id]) => allowed(rowsById[id]))
    return kept.length === Object.keys(value).length
      ? value
      : Object.fromEntries(kept)
  }
