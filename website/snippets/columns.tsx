import type { TesseraFeatures } from '@tessera-grid/tessera'
import { columnSizing, columnSorting } from '@tessera-grid/tessera/plugins'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

interface Field {
  name: string
  label: string
  width: number
}

type Item = Record<string, unknown> & { id: string }

export const plugins = [columnSorting(), columnSizing()] as const
type Features = TesseraFeatures<typeof plugins>

// Columns built from a field list: recompute them only when the list changes.
export const useColumns = (fields: Field[]) =>
  useMemo(
    (): ColumnDef<Features, Item, unknown>[] =>
      fields.map(field => ({
        id: field.name,
        accessorFn: row => row[field.name],
        header: field.label,
        cell: cell => String(cell.getValue() ?? ''),
        size: field.width,
        // The plugin enables a feature for the table; the column allows it for itself.
        enableSorting: true,
        enableResizing: true,
      })),
    [fields],
  )
