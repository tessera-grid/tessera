/**
 * Источник строк (ADR 0138, §2): строки, которые рисует тело, — по индексу и по id.
 * Клиентский режим — модель строк TanStack; серверная модель строк подставит свой.
 */

/** Строки тела: по индексу в списке и по id. */
export interface RowSource<TRow = unknown> {
  /** Строк в списке, в том числе ещё не загруженных. */
  count: () => number
  /** Строка по индексу в списке; `undefined` — нет или ещё не загружена. */
  at: (index: number) => TRow | undefined
  /** Строка данных по id, в том числе не показанная в списке (свёрнутая, на другой странице). */
  byId: (id: string) => TRow | undefined
  /** Индекс строки в списке; `-1` — её нет в списке. */
  indexOf: (id: string) => number
}

type ById = { rowsById: Record<string, { id: string } | undefined> }

interface ModelTable {
  getRowModel: () => { rows: { id: string }[] }
  getPrePaginatedRowModel: () => ById
  getCoreRowModel: () => ById
}

/** Источник клиентского режима: список — `getRowModel().rows`. */
export const createClientRowSource = (table: unknown): RowSource => {
  const t = table as ModelTable
  return {
    count: () => t.getRowModel().rows.length,
    at: index => t.getRowModel().rows[index],
    // Как `getRow(id, true)` TanStack — строки групп и других страниц, но без исключения.
    byId: id =>
      t.getPrePaginatedRowModel().rowsById[id] ??
      t.getCoreRowModel().rowsById[id],
    indexOf: id => t.getRowModel().rows.findIndex(row => row.id === id),
  }
}

/** Источник строк таблицы (метод `commonFeature`). */
export const rowSourceOf = <TRow = unknown>(table: unknown): RowSource<TRow> =>
  (table as { getRowSource: () => RowSource<TRow> }).getRowSource()
