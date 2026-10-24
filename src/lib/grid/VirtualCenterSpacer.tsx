import { memo } from 'react'

// Спейсер постоянной ширины (сумма всех центральных колонок) между блоками пиннинга.
// Держит горизонтальный экстент потока строки, пока центральные ячейки вынесены из
// потока (position:absolute). Ширина не зависит от прокрутки — не тришит layout.
// В DOM он первый, а между блоками его ставит `order`: закрепление и открепление не
// переставляют узел колонки у края, и её кнопки не теряют наведение.
export const VirtualCenterSpacer = memo(() => (
  <div
    aria-hidden
    style={{
      width: 'var(--virtual-center-width, 0px)',
      flexShrink: 0,
      alignSelf: 'stretch',
      order: 1,
    }}
  />
))

VirtualCenterSpacer.displayName = 'VirtualCenterSpacer'
