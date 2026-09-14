import { memo } from 'react'

// Пустые колонки с отступом для корректной работы виртуализации колонок.

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
