/**
 * Место строки среди строк её уровня в данных (ADR 0200, §5): хранилище знает его и после
 * вставки, удаления и переноса в середине. `row.index` — место при создании строки, его
 * получает `accessorFn`; позицию модули читают отсюда.
 */
const positions = new WeakMap<object, number>()

export const positionOf = (row: { index: number }): number =>
  positions.get(row) ?? row.index

/** Новое место строки без правки самой строки. */
export const setPosition = (row: object, position: number) => {
  positions.set(row, position)
}
