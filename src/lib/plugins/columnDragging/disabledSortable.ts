import type { Header } from '../../types'
import { zoneOf } from '../../core/columnNodes'

/** Узел шапки не перетаскивается: закреплён, колонка действий или перенос запрещён. */
export const getDisabledSortable = (
  header: Header<any, any, unknown>,
): boolean =>
  // Зона узла по его листьям: сегмент разрезанной группы в центре перемещаем.
  zoneOf(header as never) !== false ||
  header.column.getIsActionsColumn() ||
  !(header.column.getCanDrag?.() ?? false)
