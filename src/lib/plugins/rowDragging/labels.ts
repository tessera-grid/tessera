/** Подписи `rowDragging` (ADR 0182, §8): ключи словаря таблицы `rowDragging.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowDraggingLabels {
  /** Refusal text of a row move when the server sent none (ADR 0112) */
  moveRowFailed: string
  /** Announcement that a row move was refused */
  announceMoveFailed: (error: string) => string
  /** Hidden header labels of service columns (`label` of a `ServiceColumn` entry) */
  reorderColumn: string
  /** Accessible names of drag handles — the reorder menu buttons */
  moveRow: string
  /** Row handle menu items; `indentRow` / `outdentRow` — nest into the group above / move out of the group */
  moveUp: string
  moveDown: string
  /** Row handle menu in the server row model: to the ends of the list (ADR 0159, §6) */
  moveToStart: string
  moveToEnd: string
  /** Handle menu section with grouping (ADR 0186, §5). */
  moveToGroup: string
  indentRow: string
  outdentRow: string
  /** Handle menu with server grouping: an adjacent group (ADR 0189, §5). */
  moveToPreviousGroup: string
  moveToNextGroup: string
  /** Action: cancel a row move */
  actionDragCancel: string
  /** Action: the drop position changed */
  actionDragOver: string
  /** Action: drop a row */
  actionDrop: string
  /** Action: expand a group by pausing over it */
  actionExpandOnHover: string
  /** Action: waiting for the target branch before the move */
  actionAwaitBranch: string
  /** Action: nest a row with a key */
  actionNest: string
  /** Action: a row handle menu item */
  actionHandleMenu: string
}

export const rowDraggingLabels = defineLabels<RowDraggingLabels>()(
  'rowDragging',
  {
    moveRowFailed: 'Unknown error',
    announceMoveFailed: "Couldn't move row: {error}",
    reorderColumn: 'Reorder',
    moveRow: 'Move row',
    moveUp: 'Move up',
    moveDown: 'Move down',
    moveToStart: 'Move to start',
    moveToEnd: 'Move to end',
    moveToGroup: 'Move to group',
    indentRow: 'Indent',
    outdentRow: 'Outdent',
    moveToPreviousGroup: 'Move to previous group',
    moveToNextGroup: 'Move to next group',
    actionDragCancel: 'Cancel moving',
    actionDragOver: 'Choose a place',
    actionDrop: 'Drop a row',
    actionExpandOnHover: 'Expand while dragging',
    actionAwaitBranch: 'Wait for the branch',
    actionNest: 'Nest a row',
    actionHandleMenu: 'Row handle menu',
  },
  {
    announceMoveFailed: ['error'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowDragging: typeof rowDraggingLabels
  }
}
