import { memo } from 'react'

// Спейсер постоянной ширины (сумма всех центральных колонок) между блоками пиннинга.
// Держит горизонтальный экстент потока строки, пока центральные ячейки вынесены из
// потока (position:absolute). Ширина не зависит от прокрутки — не тришит layout.
export const VirtualCenterSpacer = memo(() => (
  <div
    aria-hidden
    style={{
      width: 'var(--virtual-center-width, 0px)',
      flexShrink: 0,
      alignSelf: 'stretch',
    }}
  />
))

VirtualCenterSpacer.displayName = 'VirtualCenterSpacer'
