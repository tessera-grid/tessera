/**
 * Модель группировки TanStack без холостого прохода (ADR 0068): без группировки второй
 * проход подряд не переписывает `depth`/`parentId` строк.
 */
import { createGroupedRowModel } from '@tanstack/react-table'

import { skipIdlePasses } from '../../shared/rowModels/idleRowModel'
import type { RowData, Table, TableFeatures } from '../../types'

interface GroupingTable {
  atoms: { grouping?: { get: () => unknown[] | undefined } }
  getPreGroupedRowModel: () => unknown
  autoResetExpanded?: () => void
  autoResetPageIndex?: () => void
}

export const createIdleAwareGroupedRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as GroupingTable
    const rowModel = createGroupedRowModel<TFeatures, TData>()(table)
    return skipIdlePasses(
      rowModel,
      () => t.getPreGroupedRowModel() as ReturnType<typeof rowModel>,
      () => !t.atoms.grouping?.get()?.length,
      () => {
        t.autoResetExpanded?.()
        t.autoResetPageIndex?.()
      },
    )
  }
