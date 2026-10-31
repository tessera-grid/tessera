/**
 * Хуки плагинов ячейки, которые читают соседние плагины (ADR 0150, §3): кнопка правки
 * показывает ошибку `cellErrors`, точка ошибки уступает кнопке правки `cellEditing`.
 */
import type { CellComponentProps } from '../core/createSlots'

/** Хук `cellErrors`: текст ошибки ячейки или `undefined` — ошибки нет. */
export interface CellErrorHook {
  getCellError: (ctx: CellComponentProps) => string | undefined
}

/** Хук `cellEditing`: можно ли править ячейку. */
export interface CellEditHook {
  canEditCell: (ctx: CellComponentProps) => boolean
}
