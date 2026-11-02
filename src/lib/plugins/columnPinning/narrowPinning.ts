/**
 * Эффективный пиннинг без `leafPinning` (ADR 0039, RX10): под вложенной шапкой
 * закрепляется только группа верхнего уровня целиком. Группа, чьи листья закреплены
 * частично или по разные стороны, показана незакреплённой; сохранённый срез
 * `columnPinning` не меняется.
 */
import type { ColumnPinningState } from '@tanstack/react-table'

import type { NarrowState } from '../../core/definePlugin'

interface NarrowColumn {
  getLeafColumns: () => { id: string }[]
}

interface NarrowTable {
  getAllColumns: () => NarrowColumn[]
}

export const narrowLeafPinning: NarrowState = (
  value: ColumnPinningState,
  table: NarrowTable | null,
) => {
  if (!table) {
    return undefined
  }
  const start = new Set(value.start ?? [])
  const end = new Set(value.end ?? [])
  const dropped = new Set<string>()
  for (const column of table.getAllColumns()) {
    const leaves = column.getLeafColumns().map(leaf => leaf.id)
    if (leaves.length < 2) {
      continue
    }
    const whole =
      leaves.every(id => start.has(id)) || leaves.every(id => end.has(id))
    if (!whole) {
      leaves.forEach(id => dropped.add(id))
    }
  }
  if (![...start, ...end].some(id => dropped.has(id))) {
    return value
  }
  return {
    start: (value.start ?? []).filter(id => !dropped.has(id)),
    end: (value.end ?? []).filter(id => !dropped.has(id)),
  }
}
