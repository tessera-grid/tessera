/**
 * Клавиатурное действие rowExpanding (ADR 0021): `Enter` на ячейке колонки
 * раскрытия раскрывает/сворачивает строку — тем же путём, что и кнопка.
 */
import type { CellKeyboardAction } from '../../core/keyboardActions'
import { readPluginHooks } from '../../core/definePlugin'
import { COLUMN_EXPANDING_ID } from './rowExpandingColumn'
import { toggleRowExpanded } from './toggleRowExpanded'
import type { RowExpandingHooks } from './types'

export const toggleExpandedKeyboardAction: CellKeyboardAction = {
  id: 'rowExpanding.toggle',
  scope: 'cell',
  keys: ['Enter'],
  expands: true,
  // Колонка раскрытия (и её уровни под группировкой) — где живёт кнопка.
  visible: ({ row, column }) =>
    column.id.startsWith(COLUMN_EXPANDING_ID) && row.getCanExpand(),
  run: ({ row, table }) =>
    toggleRowExpanded(
      row,
      readPluginHooks<Partial<RowExpandingHooks>>(table, 'rowExpanding'),
    ),
}
