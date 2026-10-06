/**
 * Исходная модель строк с ленивыми детьми (ADR 0054). Стоковый кэш смотрит только на
 * `data`, поэтому при смене среза `loadedChildren` модель пересоздаётся; дети строки —
 * из `subRows` данных, иначе — сохранённый ответ `loadChildren`.
 */
import { createCoreRowModel } from '@tanstack/react-table'

import type { RowData, Table, TableFeatures } from '../../types'
import { type LoadedChildren, readLoadedChildren } from './lazyChildrenFeature'

interface SubRowsTable<TData> {
  options: {
    getSubRows?: (row: TData, index: number) => TData[] | undefined
  }
  getRowId: (row: TData, index: number) => string
}

const UNSET = Symbol('unset')

export const createLazyCoreRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as SubRowsTable<TData>
    let loaded: LoadedChildren | typeof UNSET = UNSET
    let rowModel = createCoreRowModel<TFeatures, TData>()(table)

    return () => {
      const next = readLoadedChildren(table)
      if (loaded !== UNSET && next !== loaded) {
        rowModel = createCoreRowModel<TFeatures, TData>()(table)
      }
      loaded = next
      if (Object.keys(next).length === 0) {
        return rowModel()
      }
      // Опция `getSubRows` — приложения; на время сборки дополняем её ответами и
      // сразу возвращаем: стоковая сборка синхронна.
      const own = t.options.getSubRows
      t.options.getSubRows = (row, index) => {
        const subRows = own?.(row, index)
        return subRows?.length
          ? subRows
          : (next[t.getRowId(row, index)] as TData[] | undefined)
      }
      try {
        return rowModel()
      } finally {
        t.options.getSubRows = own
      }
    }
  }
