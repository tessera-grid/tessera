/**
 * Колонки быстрого поиска (ADR 0053): листья, по которым ищет грид, в порядке
 * отображения (закреплённые слева, центр, закреплённые справа). Решение «ищется ли
 * колонка» — стоковое `getCanGlobalFilter` (видимость, служебные, даты — в опции
 * `getColumnCanGlobalFilter` плагина).
 */
interface SearchColumn {
  id: string
  columnDef: { header?: unknown }
  getCanGlobalFilter?: () => boolean
}

interface SearchColumnsTable {
  getStartVisibleLeafColumns: () => SearchColumn[]
  getCenterVisibleLeafColumns: () => SearchColumn[]
  getEndVisibleLeafColumns: () => SearchColumn[]
}

export const searchColumnsOf = (table: unknown): SearchColumn[] => {
  const t = table as SearchColumnsTable
  return [
    ...t.getStartVisibleLeafColumns(),
    ...t.getCenterVisibleLeafColumns(),
    ...t.getEndVisibleLeafColumns(),
  ].filter(column => column.getCanGlobalFilter?.() ?? false)
}

export const searchColumnIdsOf = (table: unknown) =>
  searchColumnsOf(table).map(column => column.id)

/** Подпись колонки в подсказке: строковый `header`, иначе id. */
export const searchColumnLabel = (column: SearchColumn) =>
  typeof column.columnDef.header === 'string'
    ? column.columnDef.header
    : column.id
