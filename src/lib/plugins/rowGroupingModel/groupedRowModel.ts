/**
 * Модель группировки TanStack без холостого прохода (ADR 0068): без группировки второй
 * проход подряд не переписывает `depth`/`parentId` строк. Стадия переноса между группами
 * (ADR 0186, §3): значение колонки группировки лежит в кэшах строки, которые TanStack читает
 * первыми; смена стадии пересобирает модель.
 */
import { createGroupedRowModel } from '@tanstack/react-table'

import { groupMovesKey, readRowMoves } from '../../shared/rowMoves'
import { skipIdlePasses } from '../../shared/rowModels/idleRowModel'
import type { RowData, Table, TableFeatures } from '../../types'

interface StagedRow {
  _valuesCache?: Record<string, unknown>
  _groupingValuesCache?: Record<string, unknown>
}

interface GroupingTable {
  atoms: { grouping?: { get: () => unknown[] | undefined } }
  getCoreRowModel: () => { rowsById: Record<string, StagedRow | undefined> }
  getPreGroupedRowModel: () => unknown
  autoResetExpanded?: () => void
  autoResetPageIndex?: () => void
}

export const createIdleAwareGroupedRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as GroupingTable
    let rowModel = createGroupedRowModel<TFeatures, TData>()(table)
    let staged = ''
    let seeded: [StagedRow, string][] = []
    const currentModel = () => {
      const moves = readRowMoves(table)
      const key = groupMovesKey(moves)
      if (key !== staged) {
        staged = key
        for (const [row, columnId] of seeded) {
          delete row._valuesCache?.[columnId]
          delete row._groupingValuesCache?.[columnId]
        }
        seeded = []
        const { rowsById } = t.getCoreRowModel()
        for (const rowId in moves) {
          const row = rowsById[rowId]
          const values = moves[rowId]!.group
          if (!row || !values) continue
          for (const columnId in values) {
            if (row._valuesCache) row._valuesCache[columnId] = values[columnId]
            if (row._groupingValuesCache) {
              row._groupingValuesCache[columnId] = values[columnId]
            }
            seeded.push([row, columnId])
          }
        }
        rowModel = createGroupedRowModel<TFeatures, TData>()(table)
      }
      return rowModel()
    }
    return skipIdlePasses(
      currentModel,
      () => t.getPreGroupedRowModel() as ReturnType<typeof rowModel>,
      () => !t.atoms.grouping?.get()?.length,
      () => {
        t.autoResetExpanded?.()
        t.autoResetPageIndex?.()
      },
    )
  }
