import type { SortingStrategy } from '@dnd-kit/sortable'

const NO_SCALE = { scaleX: 1, scaleY: 1 }

/**
 * `verticalListSortingStrategy` без зазора между соседями (ADR 0006, D36): в
 * `SortableContext` тела — только строки окна виртуализатора и закреплённая
 * перетаскиваемая, соседи по списку не соседи на экране. Строки тела идут вплотную —
 * сдвиг равен высоте перетаскиваемой строки.
 */
export const windowedListSortingStrategy: SortingStrategy = ({
  activeIndex,
  activeNodeRect: fallbackActiveRect,
  index,
  rects,
  overIndex,
}) => {
  const activeNodeRect = rects[activeIndex] ?? fallbackActiveRect
  if (!activeNodeRect) return null

  if (index === activeIndex) {
    const overIndexRect = rects[overIndex]
    if (!overIndexRect) return null
    return {
      x: 0,
      y:
        activeIndex < overIndex
          ? overIndexRect.top +
            overIndexRect.height -
            (activeNodeRect.top + activeNodeRect.height)
          : overIndexRect.top - activeNodeRect.top,
      ...NO_SCALE,
    }
  }
  if (index > activeIndex && index <= overIndex) {
    return { x: 0, y: -activeNodeRect.height, ...NO_SCALE }
  }
  if (index < activeIndex && index >= overIndex) {
    return { x: 0, y: activeNodeRect.height, ...NO_SCALE }
  }
  return { x: 0, y: 0, ...NO_SCALE }
}
