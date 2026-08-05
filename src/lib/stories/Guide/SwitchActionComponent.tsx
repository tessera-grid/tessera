import { memo } from 'react'

import { OverflowTypography, Switch } from '../_shims'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { CellComponentProps } from '../../plugins/types'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const SwitchActionComponent = memo(
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

    return <Switch />
  },
)

SwitchActionComponent.displayName = 'SwitchActionComponent'
