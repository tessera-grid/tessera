import { memo } from 'react'

/**
 * @description
 * Пустая колонка с определенным отступом для корректной работы виртуализации.
 */
export const LeftEmptyColumn = memo(() => {
  return (
    <div
      style={{
        display: 'var(--virtual-padding-left-display)',
        width: 'var(--virtual-padding-left)',
      }}
    />
  )
})

LeftEmptyColumn.displayName = 'LeftEmptyColumn'
