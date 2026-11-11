/**
 * Хранилище строк в памяти (ADR 0200, §2): полная сборка модели ядра из `data` — строки
 * публичной `constructRow`, поля при создании, обход как у модели ядра TanStack.
 */
import { constructRow } from '@tanstack/react-table'

import { settlePositions } from '../rowPosition'
import { RowDict, dictModel } from './rowDict'

interface StoreRow {
  id: string
  index: number
  depth: number
  original: unknown
  subRows: StoreRow[]
  originalSubRows?: unknown[]
}

export interface CoreModel {
  rows: StoreRow[]
  flatRows: StoreRow[]
  readonly rowsById: Record<string, StoreRow>
}

interface StoreTable {
  options: {
    getSubRows?: (original: unknown, index: number) => unknown[] | undefined
  }
  getRowId: (original: unknown, index: number, parent?: StoreRow) => string
}

/** Модель ядра из `data`: строка, затем её потомки; `getSubRows` и `getRowId` — таблицы. */
export const buildCoreModel = (table: unknown, data: readonly unknown[]) => {
  // Отложенные места прежних строк дописываются: прежний список не держится (ADR 0211).
  settlePositions(table)
  const t = table as StoreTable
  const flatRows: StoreRow[] = []
  const rowsById: Record<string, StoreRow> = Object.create(null)
  const getSubRows = t.options.getSubRows
  const access = (
    originals: readonly unknown[],
    depth: number,
    parent?: StoreRow,
  ): StoreRow[] => {
    const rows: StoreRow[] = []
    for (let i = 0; i < originals.length; i++) {
      const original = originals[i]
      const id = t.getRowId(original, i, parent)
      const row = constructRow(
        table as never,
        id,
        original as never,
        i,
        depth,
        undefined,
        parent?.id,
      ) as unknown as StoreRow
      flatRows.push(row)
      rowsById[id] = row
      rows.push(row)
      if (getSubRows) {
        const originalSubRows = getSubRows(original, i)
        row.originalSubRows = originalSubRows
        if (originalSubRows?.length) {
          row.subRows = access(originalSubRows, depth + 1, row)
        }
      }
    }
    return rows
  }
  const rows = access(data, 0)
  const dict = new RowDict(rowsById)
  return dictModel(dict, dict.version(), rows, flatRows) as CoreModel
}
