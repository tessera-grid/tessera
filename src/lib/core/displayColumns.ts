/**
 * Колонки в порядке ОТОБРАЖЕНИЯ: start-закреплённые → центр → end-закреплённые.
 * Так упорядочены ячейки строки (`row.getVisibleCells()`), заголовки и индексы
 * колоночного виртуализатора. `getVisibleLeafColumns()` / `column.getIndex()` держат
 * натуральный порядок: колонка, закреплённая справа, в нём стоит посередине.
 */
interface DisplayColumnsTable<TColumn extends { id: string }> {
  getVisibleLeafColumns: () => TColumn[]
  getStartVisibleLeafColumns?: () => TColumn[]
  getCenterVisibleLeafColumns?: () => TColumn[]
  getEndVisibleLeafColumns?: () => TColumn[]
}

export interface DisplayColumns<
  TColumn extends { id: string } = { id: string },
> {
  columns: TColumn[]
  ids: string[]
  indexById: Map<string, number>
}

interface CacheEntry {
  parts: unknown[][]
  display: DisplayColumns<{ id: string }>
}

// Ключ — массив start-колонок (мемоизирован TanStack); сверяем и остальные части.
const displayCache = new WeakMap<object, CacheEntry>()

export const getDisplayColumns = <TColumn extends { id: string }>(
  table: DisplayColumnsTable<TColumn>,
): DisplayColumns<TColumn> => {
  const parts =
    typeof table.getStartVisibleLeafColumns === 'function'
      ? [
          table.getStartVisibleLeafColumns(),
          table.getCenterVisibleLeafColumns!(),
          table.getEndVisibleLeafColumns!(),
        ]
      : [table.getVisibleLeafColumns()]
  const cached = displayCache.get(parts[0])
  if (cached && cached.parts.every((part, i) => part === parts[i])) {
    return cached.display as DisplayColumns<TColumn>
  }
  const columns = parts.flat()
  const ids = columns.map(column => column.id)
  const display = {
    columns,
    ids,
    indexById: new Map(ids.map((id, index) => [id, index])),
  }
  displayCache.set(parts[0], { parts, display })
  return display
}

/** 0-based позиция колонки в порядке отображения; `-1`, если колонка не видима. */
export const getDisplayColumnIndex = (
  table: unknown,
  columnId: string,
): number =>
  getDisplayColumns(table as DisplayColumnsTable<{ id: string }>).indexById.get(
    columnId,
  ) ?? -1
