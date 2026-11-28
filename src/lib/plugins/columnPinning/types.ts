/** Hooks slice of the columnPinning plugin + pinning sides. */
export interface ColumnPinningHooks {
  onTogglePin: (pinned: boolean) => void
}

/**
 * Разрешённые стороны закрепления столбца в UI. `both` — обе (инлайн даёт поповер
 * выбора); `start`/`end` — только одна (прямой тумблер). Задаётся по-колоночно через
 * поле колонки `pinSides` (ADR 0165), по умолчанию `both`.
 *
 * Логическая сторона `start`/`end`, не физические `left`/`right`.
 */
export type PinSides = 'both' | 'start' | 'end'
