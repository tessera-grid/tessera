import { createContext, type RefObject } from 'react'

/**
 * Поповеры стенда, где много поповеров открыто разом (галерея): без переворота и сдвига у краёв окна;
 * с `anchor` — левым верхним углом под этим элементом, а не у своей кнопки.
 */
export interface StaticPopups {
  anchor?: RefObject<Element | null>
}

export const StaticPopupsContext = createContext<StaticPopups | null>(null)

/** Без переворота на другую сторону, сдвига внутрь окна и запасной оси. */
export const STATIC_COLLISION_AVOIDANCE = {
  side: 'none',
  align: 'none',
  fallbackAxisSide: 'none',
} as const
