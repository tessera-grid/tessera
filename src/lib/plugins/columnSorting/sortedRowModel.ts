/**
 * Обход апстрима (TanStack Table 9.2.4): `createSortedRowModel` копирует строку,
 * чьих детей переставила сортировка, но `rowsById` отдаёт оригинал. Поиск строки
 * по id (выделение ячеек, `table.getRow`) получает строку вне модели. Обёртка
 * направляет `rowsById` на копии; без копий модель отдаётся как есть.
 * См. docs/architecture/upstream-foundations.md, «Обходы апстрима».
 */
import { createSortedRowModel } from '@tanstack/react-table'

type SortedRowModelFactory = ReturnType<typeof createSortedRowModel>
type SortedRowModel = ReturnType<ReturnType<SortedRowModelFactory>>

const withClonedRowsById = (model: SortedRowModel): SortedRowModel => {
  // Без вложенных строк копий нет — обход всех строк не нужен.
  if (model.flatRows.length === model.rows.length) return model
  let rowsById: SortedRowModel['rowsById'] | undefined
  for (const row of model.flatRows) {
    if (model.rowsById[row.id] !== row) {
      rowsById ??= Object.assign(Object.create(null), model.rowsById)
      rowsById![row.id] = row
    }
  }
  return rowsById ? { ...model, rowsById } : model
}

export const createTesseraSortedRowModel = (): SortedRowModelFactory => {
  const createBase = createSortedRowModel()
  return (table => {
    const getBase = createBase(table)
    let base: SortedRowModel | undefined
    let fixed: SortedRowModel | undefined
    return () => {
      const next = getBase()
      if (next !== base) {
        base = next
        fixed = withClonedRowsById(next)
      }
      return fixed!
    }
  }) as SortedRowModelFactory
}
