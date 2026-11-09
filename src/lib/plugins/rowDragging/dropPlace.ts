/**
 * Место броска в порядке после переноса (ADR 0112, §1): родитель — ближайшая строка
 * выше слота на уровень меньше (ADR 0109, §4), индекс — по соседней сестре выше, иначе
 * ниже; на странице без сестёр — первым ребёнком. Сёстры скрыты незагруженными строками
 * серверной модели — индекс `-1` (ADR 0159, §3).
 */
import { findDropParent, indexBeforeMove } from '../../core/dragSession'
import { positionOf } from '../../core/rowPosition'

interface PlaceRow {
  id: string
  index: number
  depth: number
  parentId?: string
}

export interface DropPlace<TRow> {
  parent?: TRow
  index: number
}

/** Строки по индексу окна: массив модели или источник строк (ADR 0159). */
interface PlaceRows<TRow> {
  at: (index: number) => TRow | undefined
  readonly length: number
}

export const dropPlace = <TRow extends PlaceRow>(
  rows: PlaceRows<TRow>,
  active: PlaceRow,
  { from, to, depth }: { from: number; to: number; depth: number },
): DropPlace<TRow> => {
  const parentAt = findDropParent(rows, { from, to, depth }, 0)
  const parent = parentAt < 0 ? undefined : rows.at(parentAt)
  // Сестра в своей группе стоит после убранной строки — её индекс на один меньше.
  const sameGroup = active.parentId === parent?.id
  const shifted = (index: number) =>
    sameGroup && positionOf(active) < index ? index - 1 : index
  const at = (position: number) => rows.at(indexBeforeMove(position, from, to))
  // Незагруженная строка серверной модели: сестра могла стоять за ней (ADR 0159).
  let hidden = false
  for (let position = to - 1; position >= 0; position--) {
    const row = at(position)
    hidden = !row
    if (!row || row.depth < depth) break
    if (row.depth === depth)
      return { parent, index: shifted(positionOf(row) + 1) }
  }
  for (let position = to + 1; position < rows.length; position++) {
    const row = at(position)
    hidden ||= !row
    if (!row || row.depth < depth) break
    if (row.depth === depth) return { parent, index: shifted(positionOf(row)) }
  }
  return { parent, index: hidden ? -1 : 0 }
}
