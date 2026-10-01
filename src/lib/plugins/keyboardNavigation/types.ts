import type { ActiveCell } from '../../core/keyboardNavigation'

/** Опции плагина keyboardNavigation (ADR 0021). */
export interface KeyboardNavigationOptions {
  /** `false` — плагин присутствует, но инертен (`role="table"`, без `tabindex`). */
  enabled?: boolean
  /**
   * Активная ячейка снаружи — индексы отображения (строка шапки отрицательна);
   * новая ссылка ставит её активной (ADR 0021, KN31).
   */
  activeCell?: ActiveCell
  /** Активная ячейка сменилась — стрелками, кликом или Tab. */
  onActiveCellChange?: (next: ActiveCell) => void
}

export type { ActiveCell }
