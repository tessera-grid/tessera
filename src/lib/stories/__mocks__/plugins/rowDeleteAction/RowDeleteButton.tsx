import { memo } from 'react'

import { RowButton } from '../../../../grid/Actions/RowButton'
import { DeleteIcon } from '../../../_shims'

export interface RowDeleteButtonProps {
  onClick: () => void
  disabled?: boolean
}

export const RowDeleteButton = memo<RowDeleteButtonProps>(
  ({ disabled = false, onClick }) => {
    return (
      <RowButton
        title="Delete"
        icon={<DeleteIcon />}
        disabled={disabled}
        onClick={onClick}
      />
    )
  },
)

RowDeleteButton.displayName = 'RowDeleteButton'
