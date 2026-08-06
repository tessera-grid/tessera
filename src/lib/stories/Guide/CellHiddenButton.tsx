import { memo } from 'react'

import { Icon } from '../_shims'

import { CellButton } from '../../grid/Actions/CellButton'

export const CellHiddenButton = memo(
  ({ active, onClick }: { active: boolean; onClick: () => void }) => {
    return (
      <CellButton
        title={active ? 'показать' : 'скрыть'}
        icon={<Icon iconName="Lock" size="xs" />}
        onClick={onClick}
      />
    )
  },
)

CellHiddenButton.displayName = 'CellHiddenButton'
