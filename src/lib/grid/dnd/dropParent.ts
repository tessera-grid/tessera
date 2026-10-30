/** Индекс строки, стоящей на позиции `position` после переноса `from` → `to`. */
export const indexBeforeMove = (position: number, from: number, to: number) => {
  if (position === to) return from
  if (from < to && position >= from && position < to) return position + 1
  if (from > to && position > to && position <= from) return position - 1
  return position
}

/**
 * Будущий родитель слота (ADR 0109, §4): ближайшая строка выше места броска на
 * уровень меньше, в порядке после переноса. Поиск не уходит выше `lowest` — родитель
 * вне окна не подсвечивается. `-1` — родителя нет.
 */
export const findDropParent = (
  rows: { at: (index: number) => { depth: number } | undefined },
  { from, to, depth }: { from: number; to: number; depth: number },
  lowest: number,
): number => {
  if (depth <= 0) return -1
  for (let position = to - 1; position >= lowest; position--) {
    const index = indexBeforeMove(position, from, to)
    // Незагруженная строка серверной модели: родителя выше не видно (ADR 0159).
    const rowDepth = rows.at(index)?.depth
    if (rowDepth === undefined) return -1
    if (rowDepth < depth) return rowDepth === depth - 1 ? index : -1
  }
  return -1
}
