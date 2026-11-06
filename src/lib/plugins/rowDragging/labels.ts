/** Подписи `rowDragging` (ADR 0182, §8): ключи словаря таблицы `rowDragging.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowDraggingLabels {
  /** Текст отказа переноса строки, если сервер не прислал свой (ADR 0112) */
  moveRowFailed: string
  /** Объявление отказа переноса строки */
  announceMoveFailed: (error: string) => string
  /** Скрытые подписи заголовков служебных колонок (`label` записи `ServiceColumn`) */
  reorderColumn: string
  /** Доступные имена ручек перетаскивания — кнопок меню перестановки */
  moveRow: string
  /** Пункты меню ручки строки; `indentRow` / `outdentRow` — вложить в группу выше / вынести из группы */
  moveUp: string
  moveDown: string
  /** Меню ручки строки в серверной модели: к краям списка (ADR 0159, §6) */
  moveToStart: string
  moveToEnd: string
  /** Раздел меню ручки при группировке (ADR 0186, §5). */
  moveToGroup: string
  indentRow: string
  outdentRow: string
  /** Меню ручки при серверной группировке: соседняя группа (ADR 0189, §5). */
  moveToPreviousGroup: string
  moveToNextGroup: string
  /** Действие: отмена переноса строки */
  actionDragCancel: string
  /** Действие: смена места броска */
  actionDragOver: string
  /** Действие: бросок строки */
  actionDrop: string
  /** Действие: раскрытие группы паузой над ней */
  actionExpandOnHover: string
  /** Действие: ожидание ветки цели перед переносом */
  actionAwaitBranch: string
  /** Действие: вложить строку клавишей */
  actionNest: string
  /** Действие: пункт меню ручки строки */
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
