/**
 * Строки перетаскивания по индексу окна (ADR 0159): в клиентском режиме — модель строк
 * TanStack, в серверной модели — источник строк страницы, массива строк у неё нет.
 */
import type { RowSource } from '../../core/rowSource'
import type { Row } from '../../types'
import { rowsOf } from '../../core/rowEngine/rows'

type AnyRow = Row<any, any>

export interface DragRows {
  at: (index: number) => AnyRow | undefined
  readonly length: number
  indexOf: (id: string) => number
  byId: (id: string) => AnyRow | undefined
  /** Серверная модель: перенос — транзакцией источника, место — среди корней списка. */
  server: boolean
}

/** Все строки модели группировки, в том числе в свёрнутых группах (ADR 0186, §5). */
export const groupedRowsOf = (table: unknown) =>
  rowsOf<AnyRow>(table, 'grouped').flatRows

/** `rows` — строки модели TanStack, если они уже прочитаны. */
export const dragRowsOf = (
  table: unknown,
  rows: readonly AnyRow[] = rowsOf<AnyRow>(table, 'shown').rows,
): DragRows => {
  const source = (
    table as { getRowSource?: () => RowSource<AnyRow> }
  ).getRowSource?.()
  if (source?.moveRow) {
    return {
      at: index => (index < 0 ? undefined : source.at(index)),
      get length() {
        return source.count()
      },
      indexOf: id => source.indexOf(id),
      byId: id => source.byId(id),
      server: true,
    }
  }
  const shown = rowsOf<AnyRow>(table, 'shown')
  return {
    at: index => (index < 0 ? undefined : rows[index]),
    length: rows.length,
    indexOf: id => rows.findIndex(row => row.id === id),
    byId: id => shown.byId(id),
    server: false,
  }
}
