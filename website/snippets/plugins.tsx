import {
  DataGrid,
  useCreateTable,
  type TesseraFeatures,
} from '@tessera-grid/tessera'
import {
  columnPinning,
  columnSorting,
  rowSelection,
} from '@tessera-grid/tessera/plugins'
import type { ColumnDef } from '@tanstack/react-table'

interface Item {
  id: string
  name: string
}

type Features = TesseraFeatures<
  readonly [
    ReturnType<typeof columnSorting>,
    ReturnType<typeof columnPinning>,
    ReturnType<typeof rowSelection>,
  ]
>

const columns: ColumnDef<Features, Item, unknown>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
]

export const Items = ({ data }: { data: Item[] }) => {
  const table = useCreateTable({
    columns,
    data,
    plugins: [
      columnSorting({ multiSort: false }),
      columnPinning(),
      // Business callbacks go into the factory arguments and are read live.
      rowSelection({
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
    ],
  })

  return <DataGrid table={table} />
}
