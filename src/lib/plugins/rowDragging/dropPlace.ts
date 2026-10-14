/**
 * Место броска в порядке после переноса (ADR 0112, §1): родитель — ближайшая строка
 * выше слота на уровень меньше (ADR 0109, §4), индекс — по соседней сестре выше, иначе
 * ниже; на странице без сестёр — первым ребёнком.
 */
import { findDropParent, indexBeforeMove } from '../../grid/dnd/dropParent'

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

export const dropPlace = <TRow extends PlaceRow>(
  rows: readonly TRow[],
  active: PlaceRow,
  { from, to, depth }: { from: number; to: number; depth: number },
): DropPlace<TRow> => {
  const parentAt = findDropParent(rows, { from, to, depth }, 0)
  const parent = parentAt < 0 ? undefined : rows[parentAt]
  // Сестра в своей группе стоит после убранной строки — её индекс на один меньше.
  const sameGroup = active.parentId === parent?.id
  const shifted = (index: number) =>
    sameGroup && active.index < index ? index - 1 : index
  const at = (position: number) => rows[indexBeforeMove(position, from, to)]!
  for (let position = to - 1; position >= 0; position--) {
    const row = at(position)
    if (row.depth < depth) break
    if (row.depth === depth) return { parent, index: shifted(row.index + 1) }
  }
  for (let position = to + 1; position < rows.length; position++) {
    const row = at(position)
    if (row.depth < depth) break
    if (row.depth === depth) return { parent, index: shifted(row.index) }
  }
  return { parent, index: 0 }
}
