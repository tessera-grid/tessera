import {
  DataGrid,
  useCreateTable,
  type TesseraFeatures,
} from '@tessera-grid/tessera'
import {
  rowSelection,
  type RowSelectionValue,
} from '@tessera-grid/tessera/plugins'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

interface Item {
  id: string
  name: string
}

type Features = TesseraFeatures<readonly [ReturnType<typeof rowSelection>]>

const columns: ColumnDef<Features, Item, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
]

export const SelectableItems = ({ data }: { data: Item[] }) => {
  // A plugin's slice goes to its factory: `<slice>`, `on<Slice>Change`, `initial<Slice>`.
  const [selected, setSelected] = useState<RowSelectionValue>({})

  const table = useCreateTable({
    columns,
    data,
    plugins: [
      rowSelection({
        rowSelection: selected,
        onRowSelectionChange: setSelected,
      }),
    ],
  })

  return <DataGrid table={table} />
}
