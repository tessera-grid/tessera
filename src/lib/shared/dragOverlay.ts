import type { UniqueIdentifier } from '@dnd-kit/core'

/** Id перетаскиваемого элемента под облаком или `null` — перетаскивания нет. */
export type DragOverlayState = UniqueIdentifier | null
