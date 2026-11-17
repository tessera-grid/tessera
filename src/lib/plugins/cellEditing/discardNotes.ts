/**
 * Сбрасывание черновиков — каналу итогов записи (ADR 0222, §14): сбрасывания одного действия
 * («Сбросить всё» пульта, пункт меню) склеиваются до конца задачи в одну запись истории.
 */
import {
  notifyCellsWritten,
  type WrittenCell,
  type WrittenRow,
} from '../../core/cellWrites'

interface Batch {
  cells: WrittenCell[]
  rows: WrittenRow[]
}

const batches = new WeakMap<object, Batch>()
let discards = 0

/** Сброшенная ячейка или строка; запись уходит, когда задача закончилась. */
export const noteDiscard = (
  table: unknown,
  part: { cell: WrittenCell } | { row: WrittenRow },
) => {
  const key = table as object
  let batch = batches.get(key)
  if (!batch) {
    const fresh: Batch = { cells: [], rows: [] }
    batch = fresh
    batches.set(key, fresh)
    queueMicrotask(() => {
      batches.delete(key)
      notifyCellsWritten(table, {
        id: `discard-${++discards}`,
        source: 'discard',
        cells: fresh.cells,
        refused: [],
        draft: true,
        ...(fresh.rows.length > 0 ? { rows: fresh.rows } : {}),
      })
    })
  }
  if ('cell' in part) batch.cells.push(part.cell)
  else batch.rows.push(part.row)
}
