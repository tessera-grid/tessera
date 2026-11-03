/**
 * Методы таблицы строк до сохранения (ADR 0178, §7): `addRow` и `removeRow` кладут черновики,
 * данные не трогают. Вне `saveMode: 'manual'` и плоского списка — инертны с предупреждением.
 */
import { assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../../types'
import { addRow, removeRow } from './rowDrafts'

interface RowDraftsTableAPI<TData> {
  /** Добавить строку на место `index` видимого списка; вернуть её временный id. */
  addRow: (
    values: Partial<TData>,
    place?: { index?: number },
  ) => string | undefined
  /** Удалить строку до сохранения; новая строка уходит сразу. */
  removeRow: (id: string) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    rowDraftsFeature: TableFeature
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowDraftsFeature: RowDraftsTableAPI<TData>
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export const rowDraftsFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('rowDraftsFeature', table, {
      table_addRow: {
        fn: (values: Record<string, unknown>, place?: { index?: number }) =>
          addRow(table, values, place),
      },
      table_removeRow: { fn: (id: string) => removeRow(table, id) },
    })
  },
}
