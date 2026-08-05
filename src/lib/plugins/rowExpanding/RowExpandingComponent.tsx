import { memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { CellComponentProps } from '../types'
import { ExpandButton } from './ExpandButton'

export const RowExpandingComponent = memo(
  ({ row, table }: CellComponentProps) => {
    useSubscribeStore(() => [
      row.getIsExpanded(),
      row.getCanExpand(),
      table.options.maxExpandingDepth,
    ])

    if (!row.getCanExpand()) {
      return null
    }

    const { onExpandRow } = table.getHooks().rowExpanding

    const onExpand = () => {
      const handler = row.getToggleExpandedHandler()
      handler()
      onExpandRow(row, !row.getIsExpanded())
    }

    return <ExpandButton expanded={row.getIsExpanded()} onClick={onExpand} />
  },
)
