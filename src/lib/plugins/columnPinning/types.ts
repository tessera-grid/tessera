import type { CellData, RowData, TableFeatures } from '@tanstack/react-table'

/** Hook-слайс плагина columnPinning + стороны закрепления. */
export interface ColumnPinningHooks {
  onTogglePin: (pinned: boolean) => void
}

/**
 * Разрешённые стороны закрепления столбца в UI. `both` — обе (инлайн даёт поповер
 * выбора); `start`/`end` — только одна (прямой тумблер). Задаётся по-колоночно через
 * `columnDef.meta.pinSides`, по умолчанию `both`.
 *
 * Логическая сторона `start`/`end`, не физические `left`/`right`.
 */
export type PinSides = 'both' | 'start' | 'end'

/* eslint-disable @typescript-eslint/no-unused-vars -- generics обязаны повторять
   сигнатуру v9 ColumnMeta, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    /** Стороны закрепления в UI плагина columnPinning (по умолчанию `both`). */
    pinSides?: PinSides
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
