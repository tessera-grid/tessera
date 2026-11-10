/**
 * Раскладка строк грида: заполнитель в конце строки и размещение ячейки шапки по спанам
 * TanStack v9 (ADR 0049, ADR 0207).
 */
import type { Column } from '../types'
import {
  type SpanHeader,
  getHeaderRowStart,
  isCoveredHeader,
} from '../core/headerSpans'

const isEndPinned = (column: Pick<Column<any, any, unknown>, 'getIsPinned'>) =>
  column.getIsPinned() === 'end'

/**
 * Нужен ли заполнитель в конце строки (по последнему листу): не нужен, если
 * свободное место забирает колонка действий или первая закреплённая справа.
 */
export const needsRightFiller = (
  lastLeaf: Column<any, any, unknown> | undefined,
) => !lastLeaf || !(lastLeaf.getIsActionsColumn() || isEndPinned(lastLeaf))

/**
 * Место ячейки шапки: строка (с 1), число строк и колонок; `null` — заголовок покрыт
 * растянутым листом и не рисуется.
 */
export const getHeaderPlacement = (
  header: SpanHeader,
): { row: number; rowSpan: number; colSpan: number } | null =>
  isCoveredHeader(header)
    ? null
    : {
        row: getHeaderRowStart(header) + 1,
        rowSpan: header.rowSpan,
        colSpan: header.colSpan,
      }
