import type { CellComponentProps } from '../../core/createSlots'

/** Хуки `cellErrors` (ADR 0150): читаются живо через `table.getHooks()`. */
export interface CellErrorsHooks {
  /** Текст ошибки ячейки или `undefined` — ошибки нет. */
  getCellError: (ctx: CellComponentProps) => string | undefined
}
