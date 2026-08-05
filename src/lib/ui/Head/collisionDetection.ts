import { CollisionDetection } from '@dnd-kit/core'

export const horizontalCollisionDetection: CollisionDetection = args => {
  const { pointerCoordinates, droppableContainers } = args

  if (!pointerCoordinates) {
    return []
  }

  const x = pointerCoordinates.x

  return [...droppableContainers]
    .map(container => {
      const rect = container.rect.current

      if (!rect) {
        return {
          id: '',
          distance: 0,
        }
      }

      return {
        id: container.id,
        distance: Math.abs(x - (rect.left + rect.width * 0.1)),
      }
    })
    .filter(container => container.id !== '')
    .sort((a, b) => a.distance - b.distance)
}
