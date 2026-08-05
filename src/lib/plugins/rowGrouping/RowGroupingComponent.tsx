import { memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { HeaderComponentProps } from '../types'
import { GroupButton } from './GroupButton'

export const RowGroupingComponent = memo(
  ({ header, table }: HeaderComponentProps) => {
    useSubscribeStore(() => [
      header.column.getIsGrouped(),
      header.column.getCanGroup(),
      table.options.enableGrouping,
    ])

    if (!header.column.getCanGroup()) {
      return null
    }

    return (
      <GroupButton
        isGrouped={header.column.getIsGrouped()}
        onClick={header.column.toggleGrouping}
      />
    )
  },
)

RowGroupingComponent.displayName = 'RowGroupingComponent'
