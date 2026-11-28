import {
  DataGrid,
  useCreateTable,
  type TesseraFeatures,
} from '@tessera-grid/tessera'
import { columnSizing, columnSorting } from '@tessera-grid/tessera/plugins'
import '@tessera-grid/tessera/style.css'
import type { ColumnDef } from '@tanstack/react-table'

interface Person {
  id: string
  name: string
  age: number
}

// Plugins are presence-based: a factory in the list turns its feature on.
const plugins = [columnSorting(), columnSizing()] as const

// Column definitions live outside the component, so their identity stays stable.
const columns: ColumnDef<TesseraFeatures<typeof plugins>, Person, unknown>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  {
    accessorKey: 'age',
    header: 'Age',
    dataType: 'number',
    enableSorting: true,
  },
]

// `people` must keep its identity between renders: memoize it or keep it in state.
export const People = ({ people }: { people: Person[] }) => {
  const table = useCreateTable({ columns, data: people, plugins: [...plugins] })

  return <DataGrid table={table} height={400} />
}
