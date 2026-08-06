import { memo } from 'react'

import { Icon } from '../_shims'

import { RowButton } from '../../grid/Actions/RowButton'

export const RowDownloadButton = memo(
  ({ onClick }: { onClick: () => void }) => {
    return (
      <RowButton
        title="Скачать"
        icon={<Icon iconName="FileExport" size="xs" />}
        onClick={onClick}
      />
    )
  },
)

RowDownloadButton.displayName = 'RowDownloadButton'
