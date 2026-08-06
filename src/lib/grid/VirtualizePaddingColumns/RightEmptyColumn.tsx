import { memo } from 'react'

/**
 * @description
 * Пустая колонка с определенным отступом для корректной работы виртуализации.
 */
export const RightEmptyColumn = memo(() => {
  return (
    <div
      style={{
        display: 'var(--virtual-padding-right-display)',
        width: 'var(--virtual-padding-right)',
      }}
    />
  )
})

RightEmptyColumn.displayName = 'RightEmptyColumn'
