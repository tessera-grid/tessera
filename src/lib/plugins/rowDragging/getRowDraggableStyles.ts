import { RowDragOverlayState } from './types'

export const getRowDraggableStyles = ({
  activeId,
  acceptable,
  offsetLeft,
}: Omit<RowDragOverlayState, 'isExpanded'>) => {
  return {
    '--draggable-row-background-color': acceptable
      ? 'var(--data-grid-row-accept-draggable-bg)'
      : 'var(--data-grid-row-not-accept-draggable-bg)',
    [`--draggable-row-${activeId}-offset-left`]: offsetLeft
      ? `${offsetLeft}px`
      : '0px',
  }
}
