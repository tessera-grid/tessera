/**
 * Запись плагина rowDragging на `definePlugin`. Кастомная фича
 * `rowDraggingFeature` (слайс состояния + row-метод getCanDrag) и сервисная
 * колонка-ручка. dnd-редьюсер (getRowDraggingEvents) с геометрией offset/nesting —
 * grid-слой.
 */
import type { Row } from '../../types'
import { definePlugin } from '../../core/definePlugin'
import { COLUMN_DRAGGING_ID, getRowDraggingColumn } from './rowDraggingColumn'
import { rowDraggingFeature } from './rowDraggingFeature'
import type { RowDraggingHooks } from './types'

export interface RowDraggingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить перетаскивание строк: булево или предикат по строке. */
  enable?: boolean | ((row: Row<any, any>) => boolean)
  /** Бизнес-колбэк окончания переноса строки (аргумент фабрики). */
  onRowDragEnd?: RowDraggingHooks['onRowDragEnd']
}

export const rowDragging = definePlugin<RowDraggingOptions>()({
  id: 'rowDragging',
  features: { rowDraggingFeature },
  hooks: o => ({ onRowDragEnd: o.onRowDragEnd }),
  column: {
    id: COLUMN_DRAGGING_ID,
    make: getRowDraggingColumn,
    side: 'leading',
    order: 0,
    pin: { side: 'start', when: 'with-user' },
  },
  options: o => ({
    enableRowDragging: o.enabled === false ? false : (o.enable ?? true),
  }),
})
