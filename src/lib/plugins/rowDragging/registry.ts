/**
 * Запись плагина rowDragging (ADR 0006/0022). Кастомная фича rowDraggingFeature
 * (слайс состояния + row-метод getCanDrag) и сервисная колонка-ручка (cell —
 * компонент напрямую). dnd-редьюсер (getRowDraggingEvents) с геометрией
 * offset/nesting — grid-слой.
 */
import type { Row } from '../../types'
import type { ServiceColumn } from '../../core/createColumns'
import type { TesseraFeatureEntry } from '../../core/features'
import { COLUMN_DRAGGING_ID, getRowDraggingColumn } from './rowDraggingColumn'
import { rowDraggingFeature } from './rowDraggingFeature'
import type { RowDraggingPluginParams } from './types'

export interface RowDraggingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить перетаскивание строк: булево или предикат по строке. */
  enable?: boolean | ((row: Row<any, any>) => boolean)
  /** Бизнес-колбэк окончания переноса строки (аргумент фабрики, ADR 0027). */
  onRowDragEnd?: RowDraggingPluginParams['onRowDragEnd']
}

export const rowDragging = (opts: RowDraggingOptions = {}) =>
  ({
    id: 'rowDragging',
    enabled: opts.enabled,
    slot: {
      rowDraggingFeature,
    },
    hooks: {
      rowDragging: opts.onRowDragEnd ? { onRowDragEnd: opts.onRowDragEnd } : {},
    },
    column: {
      id: COLUMN_DRAGGING_ID,
      make: getRowDraggingColumn,
      side: 'leading',
      order: 0,
      pin: { side: 'start', when: 'with-user' },
    } satisfies ServiceColumn,
    options: {
      enableRowDragging: opts.enabled === false ? false : (opts.enable ?? true),
    },
  }) satisfies TesseraFeatureEntry<{
    rowDraggingFeature: typeof rowDraggingFeature
  }>
