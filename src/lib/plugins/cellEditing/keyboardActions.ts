/**
 * Клавиатурное действие cellEditing (ADR 0021): `Enter`/`F2` на редактируемой
 * ячейке открывают редактор (как кнопка правки). После коммита/отмены фокус
 * возвращает на ячейку ядро навигации.
 */
import type { CellKeyboardAction } from '../../core/keyboardActions'
import { readPluginHooks } from '../../core/definePlugin'
import { startEditSession } from './session'
import type { CellEditingHooks } from './types'

export const editCellKeyboardAction: CellKeyboardAction = {
  id: 'cellEditing.start',
  scope: 'cell',
  keys: ['Enter', 'F2'],
  // Кнопка правки живёт только в не-сервисных колонках — те же границы здесь.
  visible: ctx =>
    !ctx.column.getIsActionsColumn() &&
    !ctx.column.getIsRowActionsColumn() &&
    (readPluginHooks<Partial<CellEditingHooks>>(
      ctx.table,
      'cellEditing',
    ).canEdit?.(ctx) ??
      true),
  run: ({ row, column, table }) => startEditSession(table, row, column),
}
