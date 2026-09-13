import type { RowDragOverlayState } from './types'

export const getRowDraggableStyles = ({
  activeId,
  acceptable,
  offsetLeft,
}: Omit<RowDragOverlayState, 'isExpanded'>) => {
  return {
    '--draggable-row-background-color': acceptable
      ? 'var(--tsr-comp-row-accept-draggable-bg)'
      : 'var(--tsr-comp-row-not-accept-draggable-bg)',
    [`--draggable-row-${activeId}-offset-left`]: offsetLeft
      ? `${offsetLeft}px`
      : '0px',
  }
}
