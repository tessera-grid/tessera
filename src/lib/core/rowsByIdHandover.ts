/**
 * Передача словаря `rowsById` новой модели (ADR 0069): словарь модели уходит новой,
 * модели остаётся снимок по её `flatRows`, собираемый при первом чтении.
 */
import { makeObjectMap } from '@tanstack/react-table'

interface IndexedRow {
  id: string
}

export const indexRows = <TRow extends IndexedRow>(
  flatRows: readonly TRow[],
) => {
  const rowsById = makeObjectMap<TRow>()
  for (const row of flatRows) {
    rowsById[row.id] = row
  }
  return rowsById
}

export const handOverRowsById = <TRow extends IndexedRow>(model: {
  flatRows: TRow[]
  rowsById: Record<string, TRow>
}) => {
  const { flatRows, rowsById } = model
  let snapshot: Record<string, TRow> | undefined
  Object.defineProperty(model, 'rowsById', {
    configurable: true,
    enumerable: true,
    get: () => (snapshot ??= indexRows(flatRows)),
  })
  return rowsById
}
