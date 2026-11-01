/**
 * Группировка колонки записи `object` по ключу (ADR 0174, TY6): разные объекты с одним
 * ключом — одна группа; строка группы показывает запись первой строки — её подпись.
 * Свой `getGroupingValue` колонки фича не трогает.
 */
import { objectKeyOf } from '../../core/dataTypeFormat'
import type { ResolvedDataType } from '../../core/dataTypes'

export interface GroupingColumn {
  id: string
  table: unknown
  columnDef: {
    getGroupingValue?: (
      original: unknown,
      index: number,
      row: { getValue: (columnId: string) => unknown },
    ) => unknown
  }
  getDataType?: () => ResolvedDataType | undefined
}

export const objectGroupingFeature = {
  initColumnInstanceData: (column: GroupingColumn) => {
    const { columnDef } = column
    if (columnDef.getGroupingValue || column.getDataType?.()?.base !== 'object')
      return
    columnDef.getGroupingValue = (_original, _index, row) =>
      objectKeyOf(
        column.table as never,
        column as never,
        row.getValue(column.id),
      )
  },
}
