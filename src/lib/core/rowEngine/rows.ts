/**
 * Строки движка для ядра, грида и плагинов (ADR 0200, §6, SD2): модели строк TanStack читает только
 * движок. Вид — место конвейера: строки данных, после фильтра, группировки, сортировки или строки
 * тела; дети строки — в порядке показа этого места, `subRows` строки — в порядке данных.
 */
import { childrenOf } from './displayChildren'
import { engineOf } from './engine'

export type RowsView = 'core' | 'filtered' | 'grouped' | 'sorted' | 'shown'

interface ViewModel<T> {
  rows: T[]
  flatRows: T[]
  readonly rowsById: Record<string, T>
}

export interface EngineRows<T> {
  /** Строки верхнего уровня места конвейера. */
  rows: readonly T[]
  /** Все строки места: строка, затем её потомки. */
  flatRows: readonly T[]
  byId: (id: string) => T | undefined
  /** Дети строки в порядке показа этого места. */
  children: (row: T) => readonly T[]
}

const STAGE = { filtered: 'filter', grouped: 'group', sorted: 'sort' } as const

const modelOf = (table: unknown, view: RowsView) => {
  if (view === 'core') {
    return (table as { getCoreRowModel: () => unknown }).getCoreRowModel()
  }
  const engine = engineOf(table as object)
  return view === 'shown' ? engine.last() : engine.output(STAGE[view])
}

const SLOT = {
  filtered: 'filteredRowModel',
  grouped: 'groupedRowModel',
  sorted: 'sortedRowModel',
} as const

/** Есть ли у таблицы стадия места: фильтр, группировка или сортировка в наборе фич. */
export const hasRowsView = (table: unknown, view: RowsView) =>
  view === 'core' ||
  view === 'shown' ||
  !!(table as { options: { features?: Record<string, unknown> } }).options
    .features?.[SLOT[view]]

export const rowsOf = <T = unknown>(
  table: unknown,
  view: RowsView,
): EngineRows<T> => {
  const model = modelOf(table, view) as ViewModel<T>
  return {
    rows: model.rows,
    flatRows: model.flatRows,
    byId: id => model.rowsById[id],
    children: row => childrenOf(model as never, row as never) as never,
  }
}
