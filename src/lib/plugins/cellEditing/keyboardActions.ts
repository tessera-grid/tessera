/**
 * Клавиатурные действия cellEditing (ADR 0021): `Enter`/`F2` на редактируемой
 * ячейке открывают редактор (как кнопка правки), у булева — сразу переключают значение;
 * `Space` переключает булево (ADR 0175, ED5). После коммита/отмены фокус возвращает на
 * ячейку ядро навигации.
 */
import type { CellComponentProps } from '../../core/createSlots'
import type { CellKeyboardAction } from '../../core/keyboardActions'
import { readPluginHooks } from '../../core/definePlugin'
import { beginEdit, togglesInPlace } from './editors'
import { isCellPending } from './session'
import { cellEditingLabels } from './labels'
import type { CellEditingHooks } from './types'

const hooksOf = (table: unknown) =>
  readPluginHooks<Partial<CellEditingHooks>>(table as never, 'cellEditing')

// Кнопка правки живёт только в не-сервисных колонках — те же границы здесь.
const isEditable = (ctx: CellComponentProps) =>
  !ctx.column.getIsActionsColumn() &&
  !isCellPending(ctx.table, ctx.row.id, ctx.column.id) &&
  (hooksOf(ctx.table).canEditCell?.(ctx) ?? true)

const run = ({ row, column, table }: CellComponentProps) =>
  beginEdit(table, row, column, hooksOf(table), 'keyboard')

export const editCellKeyboardAction: CellKeyboardAction = {
  id: 'cellEditing.start',
  scope: 'cell',
  keys: ['Enter', 'F2'],
  shortcut: {
    combo: 'Enter',
    section: 'editing',
    label: labels => cellEditingLabels(labels).editCell,
  },
  visible: isEditable,
  run,
}

// Пробел на булевой ячейке — правка, а не выбор строки: приоритет выше.
export const toggleCellKeyboardAction: CellKeyboardAction = {
  id: 'cellEditing.toggle',
  scope: 'cell',
  keys: [' '],
  priority: 1,
  visible: ctx =>
    togglesInPlace(ctx.table, ctx.column, hooksOf(ctx.table)) &&
    isEditable(ctx),
  run,
}
