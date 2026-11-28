/** Подписи `columnDragging` (ADR 0182, §8): ключи словаря таблицы `columnDragging.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnDraggingLabels {
  /** Refusal text of a column move when the server sent none (ADR 0114) */
  moveColumnFailed: string
  /** Announcement that a column move was refused */
  announceColumnMoveFailed: (error: string) => string
  /** Accessible names of drag handles — the reorder menu buttons */
  moveColumn: string
  /** Column handle menu items */
  moveLeft: string
  moveRight: string
  /** Action: cancel a column move */
  actionDragCancel: string
  /** Action: drop a column */
  actionDrop: string
  /** Action: a column handle menu item */
  actionHandleMenu: string
}

export const columnDraggingLabels = defineLabels<ColumnDraggingLabels>()(
  'columnDragging',
  {
    moveColumnFailed: 'Unknown error',
    announceColumnMoveFailed: "Couldn't move column: {error}",
    moveColumn: 'Move column',
    moveLeft: 'Move left',
    moveRight: 'Move right',
    actionDragCancel: 'Cancel moving',
    actionDrop: 'Drop a column',
    actionHandleMenu: 'Column handle menu',
  },
  {
    announceColumnMoveFailed: ['error'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnDragging: typeof columnDraggingLabels
  }
}
