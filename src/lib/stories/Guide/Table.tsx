import { useMemo, useState } from 'react'

import { Row } from '@tanstack/react-table'
import { action } from 'storybook/actions'

import { useCreateHooks } from '../../core/createHooks/useCreateHooks'
import { useRowSelectionState } from '../../core/createState/rowSelectionState'
import { useCreateTable } from '../../core/createTable/useCreateTable'
import { DataGrid } from '../../grid/DataGrid/DataGrid'
import type { BuiltinPluginsHooks } from '../../plugins'
import { rowActions } from '../../plugins/rowActions'
import { rowSelection as selectionPlugin } from '../../plugins/rowSelection'
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

  const hooks = useCreateHooks<BuiltinPluginsHooks & MyTableHooks>({
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
    BuiltinPluginsHooks & MyTableHooks,
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
    plugins: [
      selectionPlugin(),
      rowActions({ width: 40 }),
      // Пользовательские плагины приносят свою фичу через ту же запись реестра.
      { id: 'rowDownloadAction', feature: rowDownloadActionPlugin },
      { id: 'cellHiddenAction', feature: cellHiddenActionPlugin },
      { id: 'switchAction', feature: switchActionPlugin },
    ],
  })

  return <DataGrid table={table} />
}
