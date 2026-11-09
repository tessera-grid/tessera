/**
 * Модель ядра по умолчанию (ADR 0194, §2): смена `data` собирает модель из прежней по
 * тождеству строк, иначе — полная сборка хранилища в памяти (ADR 0200). Автосбросы при смене
 * `data` — те же, что у мемо TanStack (IU9).
 */
import { type ChangeModel, patchCoreModel } from './dataChanges'
import { buildCoreModel } from './rowEngine/memoryStore'
import type { RowData, Table, TableFeatures } from '../types'

interface ResettingTable {
  options: { data: unknown }
  autoResetExpanded?: () => void
  autoResetPageIndex?: () => void
  autoResetSorting?: () => void
  autoResetCellSelection?: () => void
}

/** Автосбросы смены `data` — как `onAfterUpdate` модели ядра TanStack. */
export const autoResetOnDataChange = (table: unknown) => {
  const t = table as ResettingTable
  t.autoResetExpanded?.()
  t.autoResetPageIndex?.()
  t.autoResetSorting?.()
  t.autoResetCellSelection?.()
}

export const createIncrementalCoreRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as ResettingTable
    let last: { data: unknown; model: ChangeModel } | undefined
    return () => {
      const data = t.options.data
      if (last && last.data === data) return last.model as never
      if (last) {
        const model = patchCoreModel<TData>(table, last.model, last.data, data)
        if (model) {
          last = { data, model }
          autoResetOnDataChange(table)
          return model as never
        }
      }
      const model = buildCoreModel(
        table,
        data as readonly unknown[],
      ) as unknown as ChangeModel
      // Как мемо TanStack: полная сборка после смены `data` — сброс после пересчёта.
      if (last) queueMicrotask(() => autoResetOnDataChange(table))
      last = { data, model }
      return model as never
    }
  }
