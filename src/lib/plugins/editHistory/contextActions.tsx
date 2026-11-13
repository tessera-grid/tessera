/**
 * Пункты «Отменить» и «Повторить» в контекстном меню ячейки (ADR 0222, §11): подпись называет
 * запись, без записи пункт недоступен.
 */
import type { ContextMenuAction } from '../../core/headerActions'
import { RedoIcon, UndoIcon } from './icons'
import { canRedo, canUndo, nextLabel, step } from './history'

/** Пункты в меню, пока их не выключил аргумент `contextMenu`. */
const inMenu = (ctx: { table: unknown }) =>
  (ctx.table as { options: { editHistoryContextMenu?: boolean } }).options
    .editHistoryContextMenu !== false

const nameParams =
  (direction: 'undo' | 'redo') =>
  (ctx: { table: unknown }, labels: Parameters<typeof nextLabel>[2]) => {
    const name = nextLabel(ctx.table, direction, labels)
    return name ? { name } : {}
  }

export const undoContextAction: ContextMenuAction = {
  id: 'undo',
  order: 'last',
  icon: () => <UndoIcon />,
  visible: inMenu,
  params: nameParams('undo'),
  disabled: ctx => !canUndo(ctx.table),
  target: () => false,
  onSelect: ctx => {
    void step(ctx.table, 'undo', 'pointer')
  },
}

export const redoContextAction: ContextMenuAction = {
  id: 'redo',
  order: 'last',
  icon: () => <RedoIcon />,
  visible: inMenu,
  params: nameParams('redo'),
  disabled: ctx => !canRedo(ctx.table),
  target: () => false,
  onSelect: ctx => {
    void step(ctx.table, 'redo', 'pointer')
  },
}
