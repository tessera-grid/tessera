import { AnimateLayoutChanges } from '@dnd-kit/sortable'

export const animateLayoutChanges: AnimateLayoutChanges = ({
  isSorting,
  wasDragging,
}) => !(isSorting || wasDragging)
