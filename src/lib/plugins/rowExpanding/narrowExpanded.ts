/**
 * Эффективное раскрытие при `maxDepth` (ADR 0039, RX8): строки глубже предела
 * показаны свёрнутыми, сохранённый срез `expanded` не меняется. При активной
 * группировке раскрытием владеет rowGrouping — сужения нет.
 */
import type { ExpandedState } from '@tanstack/react-table'

import type { NarrowState } from '../../core/effectiveState'

interface NarrowRow {
  id: string
  depth: number
  subRows: unknown[]
}

interface NarrowTable {
  atoms: { grouping?: { get: () => unknown[] } }
  getCoreRowModel: () => {
    flatRows: NarrowRow[]
    rowsById: Record<string, NarrowRow | undefined>
  }
}

export const narrowExpandedByDepth =
  (maxDepth: number): NarrowState =>
  (value: ExpandedState, table: NarrowTable | null) => {
    if (!table) {
      return undefined
    }
    if ((table.atoms.grouping?.get() ?? []).length > 0) {
      return value
    }
    const { flatRows, rowsById } = table.getCoreRowModel()
    if (value === true) {
      const tooDeep = flatRows.some(
        row => row.subRows.length > 0 && row.depth >= maxDepth,
      )
      if (!tooDeep) {
        return value
      }
      return Object.fromEntries(
        flatRows
          .filter(row => row.subRows.length > 0 && row.depth < maxDepth)
          .map(row => [row.id, true]),
      )
    }
    // Неизвестная строка (группа, новые данные) остаётся как есть.
    const allowed = Object.entries(value).filter(
      ([id]) => (rowsById[id]?.depth ?? -1) < maxDepth,
    )
    return allowed.length === Object.keys(value).length
      ? value
      : Object.fromEntries(allowed)
  }
