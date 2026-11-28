/**
 * Хуки плагинов ячейки, которые читают соседние плагины (ADR 0150, §3): кнопка правки
 * показывает ошибку `cellErrors`, точка ошибки уступает кнопке правки `cellEditing`.
 */
import type { CellComponentProps } from '../core/createSlots'

/** The `cellErrors` hook: a cell's error text, or `undefined` — no error. */
export interface CellErrorHook {
  getCellError: (ctx: CellComponentProps) => string | undefined
}

/** Хук `cellEditing`: можно ли править ячейку. */
export interface CellEditHook {
  canEditCell: (ctx: CellComponentProps) => boolean
}
