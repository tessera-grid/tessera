/**
 * Данные гайдов правки по типу (ADR 0175): товары с ценой и наличием и свой тип
 * «приоритет» со своим редактором из реестра `dataTypes`.
 */
import { useLayoutEffect, useRef } from 'react'

import type { DataTypeRegistry } from '../../core/dataTypes'
import type { CellEditor } from '../../plugins'
import type { ColumnDef } from '../../types'
import { Segments } from '../../ui/Segments'
import { MONEY_TYPES, productColumns, productRows } from './dataTypesData'

export const EDIT_ROWS = productRows(10)

/** Цена — деньги, наличие — булево (S1, S2). */
export const EDIT_COLUMNS: ColumnDef<any, any>[] = productColumns(
  'money',
).filter(column =>
  ['name', 'price', 'quantity', 'inStock'].includes(column.id!),
)

export { MONEY_TYPES as EDIT_TYPES }

const PRIORITIES = [
  { value: '1', label: 'Low' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'High' },
]

const priorityLabel = (value: unknown) =>
  PRIORITIES.find(option => option.value === String(value))?.label ?? ''

/** Редактор приоритета — сегменты кита: выбор сохраняет, Escape и уход фокуса отменяют. */
const PriorityEdit = ({
  value,
  label,
  commit,
  cancel,
}: Parameters<CellEditor>[0]) => {
  const root = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    root.current
      ?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.focus({ preventScroll: true })
  }, [])
  return (
    <span
      ref={root}
      data-priority-editor
      onKeyDown={event => {
        if (event.key === 'Escape') cancel()
      }}
      onBlur={event => {
        if (!root.current?.contains(event.relatedTarget as Node | null))
          cancel()
      }}
    >
      <Segments
        aria-label={label}
        value={String(value)}
        options={PRIORITIES}
        onValueChange={next => commit(Number(next))}
      />
    </span>
  )
}

/** Свой тип «приоритет»: число 1–3, подпись словом и свой редактор (S7). */
export const PRIORITY_TYPES: DataTypeRegistry = {
  priority: {
    extends: 'number',
    align: 'start',
    formatValue: priorityLabel,
    editor: props => <PriorityEdit {...props} />,
  },
}

export const PRIORITY_ROWS = EDIT_ROWS.map((row, index) => ({
  id: row.id,
  name: row.name,
  priority: (index % 3) + 1,
}))

export const PRIORITY_COLUMNS: ColumnDef<any, any>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name', dataType: 'text' },
  {
    id: 'priority',
    accessorKey: 'priority',
    header: 'Priority',
    dataType: 'priority',
    // Три сегмента редактора — без обрезки подписей.
    size: 280,
  },
]

export { priorityLabel }

/** Дата выпуска — день, обновление — момент со временем (S3). */
export const DATE_COLUMNS: ColumnDef<any, any>[] = productColumns().filter(
  column => ['name', 'released', 'updatedAt'].includes(column.id!),
)
