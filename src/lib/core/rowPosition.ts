/**
 * Место строки среди строк её уровня в данных (ADR 0200, §5): хранилище знает его и после
 * вставки, удаления и переноса в середине. `row.index` — место при создании строки, его
 * получает `accessorFn`; позицию модули читают отсюда.
 */
const positions = new WeakMap<object, number>()

export const positionOf = (row: { index: number }): number =>
  positions.get(row) ?? row.index

/** Новое место строки без правки самой строки; место, равное `index`, записи не держит. */
export const setPosition = (row: object, position: number) => {
  if ((row as { index?: number }).index === position) positions.delete(row)
  else positions.set(row, position)
}

/** Место строки — её копии с тем же `index`: запись переходит, только если она есть. */
export const copyPosition = (from: object, to: object) => {
  const position = positions.get(from)
  if (position !== undefined) positions.set(to, position)
}
