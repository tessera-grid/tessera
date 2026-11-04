/** Подписи `columnDragging` (ADR 0182, §8): ключи словаря таблицы `columnDragging.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnDraggingLabels {
  /** Текст отказа переноса колонки, если сервер не прислал свой (ADR 0114) */
  moveColumnFailed: string
  /** Объявление отказа переноса колонки */
  announceColumnMoveFailed: (error: string) => string
  /** Доступные имена ручек перетаскивания — кнопок меню перестановки */
  moveColumn: string
  /** Пункты меню ручки колонки */
  moveLeft: string
  moveRight: string
  /** Действие: отмена переноса колонки */
  actionDragCancel: string
  /** Действие: бросок колонки */
  actionDrop: string
  /** Действие: пункт меню ручки колонки */
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
