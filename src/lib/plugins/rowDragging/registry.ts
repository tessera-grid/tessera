/**
 * Запись плагина rowDragging на `definePlugin`. Кастомная фича
 * `rowDraggingFeature` (слайс состояния + row-метод getCanDrag) и сервисная
 * колонка-ручка. dnd-редьюсер (getRowDraggingEvents) с геометрией offset/nesting —
 * grid-слой.
 */
import type { Updater } from '@tanstack/react-table'

import type { Row } from '../../types'
import { definePlugin } from '../../core/definePlugin'
import { COLUMN_DRAGGING_ID, getRowDraggingColumn } from './rowDraggingColumn'
import { moveRowKeyboardAction, nestRowKeyboardAction } from './keyboardActions'
import {
  rowDraggingFeature,
  rowDraggingInertReason,
} from './rowDraggingFeature'
import { reconcileRowMoves } from './reconcileRowMoves'
import type { RowDraggingHooks } from './types'
import { DEFAULT_ROW_DRAG_EXPAND_DELAY } from './getRowDraggingEvents'

export interface RowDraggingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Можно ли тащить строку; по умолчанию — любую. Выключить плагин — `enabled`. */
  canDragRow?: (row: Row<any, any>) => boolean
  /**
   * Пауза над свёрнутой группой, после которой она раскрывается, мс; по умолчанию 500,
   * `0` — не раскрывать (ADR 0109).
   */
  expandDelay?: number
  /**
   * Строка перенесена: место после переноса; промис — ожидание на ручке. В ленивом
   * дереве без него перенос недопустим (ADR 0112).
   */
  onRowDragEnd?: RowDraggingHooks['onRowDragEnd']
  /**
   * Откатывать перенос при отказе промиса `onRowDragEnd`; по умолчанию `true`. `false` —
   * клиент остаётся с новым порядком, расхождение с сервером допускается (ADR 0114).
   */
  revertOnReject?: boolean
  /** Перетаскивание отменено: Escape, бросок мимо, запрет на лету, строка ушла (ADR 0040). */
  onRowDragCancel?: RowDraggingHooks['onRowDragCancel']
  /**
   * Новый порядок данных после переноса — функцией от прежних (ADR 0120, §4): приложение
   * применяет её к своим `data`.
   */
  onRowOrderChange?: (updater: Updater<any[]>) => void
}

export const rowDragging = definePlugin<RowDraggingOptions>()({
  id: 'rowDragging',
  // Предикат влияет на отрисовку ячеек: новая ссылка — перерисовка (ADR 0039).
  refreshOn: ['canDragRow'],
  features: { rowDraggingFeature },
  hooks: o => ({
    onRowDragEnd: o.onRowDragEnd,
    onRowDragCancel: o.onRowDragCancel,
  }),
  keyboardActions: [moveRowKeyboardAction, nestRowKeyboardAction],
  diagnose: rowDraggingInertReason,
  reconcile: reconcileRowMoves,
  column: {
    id: COLUMN_DRAGGING_ID,
    make: getRowDraggingColumn,
    side: 'leading',
    order: 0,
    pin: { side: 'start', when: 'with-user' },
  },
  options: o => ({
    enableRowDragging: o.enabled === false ? false : (o.canDragRow ?? true),
    rowDragExpandDelay: o.expandDelay ?? DEFAULT_ROW_DRAG_EXPAND_DELAY,
    rowDragRevertOnReject: o.revertOnReject !== false,
    onRowOrderChange: o.onRowOrderChange,
  }),
})
