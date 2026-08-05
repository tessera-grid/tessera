import { memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { CellComponentProps } from '../../plugins/types'
import { CellHiddenButton } from './CellHiddenButton'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const CellHiddenComponent = memo(
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

    const isHidden = table.getState().hiddenCells[cell.id]
    const { onChangeHiddenCells } = table.options

    return (
      <CellHiddenButton
        active={isHidden}
        onClick={() => {
          onChangeHiddenCells(prev => ({
            ...prev,
            [cell.id]: !prev[cell.id],
          }))
        }}
      />
    )
  },
)

CellHiddenComponent.displayName = 'CellHiddenComponent'
