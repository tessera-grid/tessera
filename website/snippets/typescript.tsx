import { useCreateTable, type TesseraFeatures } from '@tessera-grid/tessera'
import { columnPinning, columnSorting } from '@tessera-grid/tessera/plugins'
import type { ColumnDef } from '@tanstack/react-table'

interface Person {
  id: string
  name: string
}

// Keep the plugin list outside the component: it also defines the feature type.
const plugins = [columnPinning(), columnSorting()] as const
type Features = TesseraFeatures<typeof plugins>

const columns: ColumnDef<Features, Person, unknown>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
]

export const usePeopleTable = (data: Person[]) =>
  useCreateTable({ columns, data, plugins: [...plugins] })
