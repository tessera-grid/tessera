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
import { CellHiddenComponent } from './CellHiddenComponent'
import { RowDownloadComponent } from './RowDownloadComponent'
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
      // Пользовательские плагины приносят свою фичу и декларативные слоты через
      // ту же запись реестра.
      {
        id: 'rowDownloadAction',
        feature: rowDownloadActionPlugin,
        slots: [
          {
            id: 'rowDownloadActionPlugin',
            order: 0,
            slot: 'actionRowSlot',
            component: RowDownloadComponent,
          },
        ],
      },
      {
        id: 'cellHiddenAction',
        feature: cellHiddenActionPlugin,
        slots: [
          {
            id: 'cellHiddenActionPlugin',
            slot: 'rightCellSlot',
            order: 0,
            component: CellHiddenComponent,
          },
        ],
      },
      { id: 'switchAction', feature: switchActionPlugin },
    ],
  })

  return <DataGrid table={table} />
}
