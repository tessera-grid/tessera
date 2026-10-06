/**
 * Шаг отступа уровня вложенности строки (ADR 0059): токен темы
 * `--tsr-comp-row-nesting-indent`. Делят ядро (отступ первой колонки, линии дерева — в
 * CSS) и rowDragging (смещение строки-оверлея по уровням — в JS).
 */
import { readGridToken } from './announcer'

export const ROW_NESTING_INDENT_TOKEN = '--tsr-comp-row-nesting-indent'

/** Шаг в px без смонтированного грида. */
export const ROW_NESTING_INDENT_PX = 16

/** Шаг из темы смонтированного грида, px. */
export const readRowNestingIndent = (table: unknown): number =>
  parseFloat(readGridToken(table, ROW_NESTING_INDENT_TOKEN)) ||
  ROW_NESTING_INDENT_PX
