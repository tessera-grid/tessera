export type ColumnPinningPluginScope = 'columnPinning'

export interface ColumnPinningPluginParams {
  onTogglePin: (pinned: boolean) => void
}

export type ColumnPinningPlugin = Record<
  ColumnPinningPluginScope,
  ColumnPinningPluginParams
>

/**
 * Разрешённые стороны закрепления столбца в UI. `both` — доступны обе (инлайн
 * даёт поповер с выбором стороны); `left`/`right` — только одна (инлайн даёт
 * прямой тумблер без поповера). Задаётся по-колоночно через `columnDef.meta`,
 * по умолчанию `both` (ADR 0011).
 */
export type PinSides = 'both' | 'left' | 'right'
