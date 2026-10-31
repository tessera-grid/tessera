/**
 * Модель бесконечной прокрутки (ADR 0081): когда просить блок, сколько скелет-строк
 * в хвосте и инертность рядом с пагинацией. О клиентской обработке загруженных строк
 * предупреждает ядро (ADR 0169, §3).
 */
import { isPaginationActive } from '../../core/dataMode'
import { pluginStateKey } from '../../core/definePlugin'
import {
  type PluginDiagnose,
  serverRowModelReason,
} from '../../core/pluginDiagnostics'
import type { InfiniteScrollState } from './types'

export const INFINITE_SCROLL = 'infiniteScroll'

export const IDLE: InfiniteScrollState = { status: 'idle', tailRows: 0 }

/** Пагинация включена: страницы и лента — взаимоисключающие модели позиции. */
export const infiniteScrollInertReason: PluginDiagnose = table =>
  serverRowModelReason(table) ??
  (isPaginationActive(table) ? 'pagination' : undefined)

export const readInfiniteScrollState = (
  state: Record<string, unknown>,
): InfiniteScrollState =>
  (state[pluginStateKey(INFINITE_SCROLL)] as InfiniteScrollState | undefined) ??
  IDLE

/** `aria-busy` таблицы: блок в пути. */
export const isLoadingMore = (state: object) =>
  readInfiniteScrollState(state as Record<string, unknown>).status === 'pending'

/** Итог для `aria-rowcount`: известный, `-1` при неизвестном или `undefined` — строк столько, сколько в `data`. */
export const totalRowCountOf =
  (hasMore: boolean, rowCount: number | undefined) => (table: unknown) =>
    infiniteScrollInertReason(table)
      ? undefined
      : (rowCount ?? (hasMore ? -1 : undefined))

export interface EdgeInput {
  /** От конца тела до нижнего края области прокрутки, px; меньше нуля — конец виден. */
  distance: number
  thresholdPx: number
  hasMore: boolean
  status: InfiniteScrollState['status']
  /** Последний ответ не принёс строк: до следующей прокрутки не просить. */
  stalled: boolean
  loaded: number
}

export const shouldLoadMore = ({
  distance,
  thresholdPx,
  hasMore,
  status,
  stalled,
  loaded,
}: EdgeInput) =>
  hasMore &&
  status === 'idle' &&
  !stalled &&
  loaded > 0 &&
  distance <= thresholdPx

/** Хвост — на высоту окна, но не больше оставшихся строк известного итога. */
export const tailRowCount = (
  viewportRows: number,
  loaded: number,
  rowCount: number | undefined,
) =>
  Math.max(
    1,
    rowCount === undefined
      ? viewportRows
      : Math.min(viewportRows, rowCount - loaded),
  )
