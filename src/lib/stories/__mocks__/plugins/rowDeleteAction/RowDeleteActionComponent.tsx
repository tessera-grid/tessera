import { memo } from 'react'

import { RowDeleteButton } from './RowDeleteButton'

export const RowDeleteActionComponent = memo(() => {
  return <RowDeleteButton onClick={() => null} />
})

RowDeleteActionComponent.displayName = 'RowDeleteActionComponent'
