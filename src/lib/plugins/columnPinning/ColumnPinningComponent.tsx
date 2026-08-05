import { memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { HeaderComponentProps } from '../types'
import { PinButton } from './PinButton'

export const ColumnPinningComponent = memo(
  ({ column, table }: HeaderComponentProps) => {
    useSubscribeStore(() => [
      column.getIsPinned(),
      column.getCanPin(),
      table.options.enableColumnPinning,
    ])

    if (!column.getCanPin()) {
      return null
    }

    const isPinned = column.getIsPinned()
    const nextPinned = isPinned === 'left' ? false : 'left'

    const handleClick = () => {
      const { onTogglePin } = table.getHooks().columnPinning

      column.pin(nextPinned)
      onTogglePin(!!nextPinned)
    }

    return <PinButton isPinned={isPinned === 'left'} onClick={handleClick} />
  },
)
