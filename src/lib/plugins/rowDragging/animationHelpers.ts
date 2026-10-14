import type { AnimateLayoutChanges } from '@dnd-kit/sortable'

/**
 * Анимация раскладки dnd-kit выключена: строки двигает `RowMotion` (ADR 0107). В
 * `SortableContext` — только строки окна, и прокрутка меняет их индексы: dnd-kit сдвигал
 * строку на кадр от прямоугольника, замеренного в прошлом перетаскивании (RM29).
 */
export const animateLayoutChanges: AnimateLayoutChanges = () => false
