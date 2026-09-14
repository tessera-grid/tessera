/** Фаза E — hook-слайс плагина columnPinning (v9) + стороны закрепления. */
export type ColumnPinningPluginScope = 'columnPinning'

export interface ColumnPinningPluginParams {
  onTogglePin: (pinned: boolean) => void
}

export type ColumnPinningPlugin = Record<
  ColumnPinningPluginScope,
  ColumnPinningPluginParams
>

/**
 * Разрешённые стороны закрепления столбца в UI. `both` — обе (инлайн даёт поповер
 * выбора); `start`/`end` — только одна (прямой тумблер). Задаётся по-колоночно через
 * `columnDef.meta.pinSides`, по умолчанию `both` (ADR 0011).
 *
 * v9: логическая сторона `start`/`end` вместо физических `left`/`right`.
 */
export type PinSides = 'both' | 'start' | 'end'
