import { useMemo, useState } from 'react'

import { Row } from '@tanstack/react-table'
import { action } from 'storybook/actions'

import { useCreateHooks } from '../../core/createHooks/useCreateHooks'
import { useRowSelectionState } from '../../core/createState/rowSelectionState'
import { useCreateTable } from '../../core/createTable/useCreateTable'
import { DataGrid } from '../../grid/DataGrid/DataGrid'
import { cellHiddenActionPlugin } from './cellHiddenActionPlugin'
import { rowDownloadActionPlugin } from './rowDownloadActionPlugin'
import { switchActionPlugin } from './switchActionPlugin'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection, onRowSelectionChange } = useRowSelectionState()
  const hiddenCellsInitialState = useMemo(() => ({}), [])
  const [hiddenCells, setHiddenCells] = useState<MyTableState['hiddenCells']>(
    hiddenCellsInitialState,
  )

  const hooks = useCreateHooks<MyTableHooks>({
    rowSelection: {
      onSelectRow: (row: Row<any>, selected: boolean) =>
        action('onSelectRow')({ rowId: row.id, selected }),
      onSelectAllRowsOnPage: (selected: boolean) =>
        action('onSelectAllRowsOnPage')({ selected }),
      isAllRowsSelected: false,
    },
    rowDownloadAction: {
      onDownload: (fileId: string) => action('onDownload')({ fileId }),
    },
  })

  const table = useCreateTable<
    ItemType,
    MyTableHooks,
    MyTableState,
    MyTableOptions
  >({
    columns,
    data,
    state: {
      rowSelection,
      hiddenCells,
    },
    handlers: {
      onRowSelectionChange,
      onChangeHiddenCells: setHiddenCells,
    },
    hooks,
    enableRowSelection: true,
    enableRowActions: true,
    rowActionsOptions: {
      width: 40,
    },
    plugins: [
      rowDownloadActionPlugin,
      cellHiddenActionPlugin,
      switchActionPlugin,
    ],
  })

  return <DataGrid table={table} />
}
