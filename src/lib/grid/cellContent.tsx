// Содержимое ячейки тела: свой `cell` колонки или ячейка ядра по типу; булево в ячейке
// ядра — значок кита (ADR 0172, DT6).
import { flexRender } from '@tanstack/react-table'

import { defaultCell } from '../core/commonFeature'
import { alignOf, isNumericBase } from '../core/dataTypeFormat'
import type { TableLabels } from '../core/localization'
import type { Cell, Column } from '../types'
import { CheckboxView } from '../ui/Checkbox/CheckboxView'

export const renderCellContent = (
  cell: Cell<any, any, unknown>,
  labels: TableLabels,
  value: unknown = cell.getValue(),
  /** `value` — не значение строки: его же видит рендерер ячейки (ADR 0186, §3). */
  overridden = false,
) => {
  const { column } = cell
  if (
    column.columnDef.cell === defaultCell &&
    column.getDataType()?.base === 'boolean'
  ) {
    if (typeof value === 'boolean') {
      return (
        <CheckboxView
          checked={value}
          label={value ? labels.booleanTrue : labels.booleanFalse}
        />
      )
    }
  }
  const base = cell.getContext()
  const context = overridden
    ? {
        ...base,
        getValue: () => value as never,
        renderValue: () =>
          (value ?? base.table.options.renderFallbackValue) as never,
      }
    : base
  // Ячейка ядра — функция форматирования без хуков: вызов, а не компонент на ячейку (ADR 0208).
  if (column.columnDef.cell === defaultCell)
    return defaultCell(context as never)
  return flexRender(column.columnDef.cell, context)
}

/** Атрибуты выравнивания ячейки и заголовка колонки (ADR 0172, DT9). */
export const alignAttrs = (column: Column<any, any, unknown>) => ({
  'data-align': alignOf(column.table as never, column),
  'data-numeric': isNumericBase(column.getDataType()?.base) || undefined,
})
