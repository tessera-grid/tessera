import { memo } from 'react'

import { CellComponentProps } from '../../plugins/types'
import { RowDownloadButton } from './RowDownloadButton'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const RowDownloadComponent = memo(
  ({
    row,
    table,
  }: CellComponentProps<
    ItemType,
    MyTableHooks,
    MyTableState,
    MyTableOptions
  >) => {
    const { onDownload } = table.getHooks().rowDownloadAction

    return <RowDownloadButton onClick={() => onDownload(row.original.id)} />
  },
)

RowDownloadComponent.displayName = 'RowDownloadComponent'
