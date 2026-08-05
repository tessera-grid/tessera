import { memo } from 'react'

import { OverflowTypography } from '../_shims'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { CellComponentProps } from '../../plugins/types'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const Cell = memo(
  ({
    cell,
    table,
  }: CellComponentProps<
    ItemType,
    MyTableHooks,
    MyTableState,
    MyTableOptions
  >) => {
    useSubscribeStore(() => [table.getState().hiddenCells[cell.id]])

    if (table.getState().hiddenCells[cell.id]) {
      return (
        <OverflowTypography typographyProps={{ variant: 'subtitle2' }}>
          Содержимое скрыто
        </OverflowTypography>
      )
    }

    return (
      <OverflowTypography typographyProps={{ variant: 'subtitle2' }}>
        <>{cell.getValue()}</>
      </OverflowTypography>
    )
  },
)

Cell.displayName = 'Cell'
