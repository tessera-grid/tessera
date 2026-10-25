/**
 * Модель бесконечной прокрутки (ADR 0081): когда просить блок, сколько скелет-строк
 * в хвосте, инертность рядом с пагинацией и предупреждения о клиентской обработке.
 */
import { pluginStateKey } from '../../core/definePlugin'
import { logWarn } from '../../core/logger'
import {
  type PluginDiagnose,
  serverRowModelReason,
} from '../../core/pluginDiagnostics'
import type { InfiniteScrollState } from './types'

export const INFINITE_SCROLL = 'infiniteScroll'

export const IDLE: InfiniteScrollState = { status: 'idle', tailRows: 0 }

interface ScrollTable {
  options: Record<string, unknown>
  store: { get: () => Record<string, unknown> }
}

/** Пагинация включена: страницы и лента — взаимоисключающие модели позиции. */
const paginationActive = (table: unknown) =>
  (table as ScrollTable).options.paginateExpandedRows === false

export const infiniteScrollInertReason: PluginDiagnose = table =>
  serverRowModelReason(table) ??
  (paginationActive(table) ? 'pagination' : undefined)

export const readInfiniteScrollState = (
  state: Record<string, unknown>,
): InfiniteScrollState =>
  (state[pluginStateKey(INFINITE_SCROLL)] as InfiniteScrollState | undefined) ??
  IDLE

/** `aria-busy` таблицы: блок в пути. */
export const isLoadingMore = (state: Record<string, unknown>) =>
  readInfiniteScrollState(state).status === 'pending'

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

type ClientFeature = 'sorting' | 'filtering' | 'search' | 'grouping'

/** Обработка, которая на клиенте видит только загруженные строки. */
export const clientRowModelFeatures = (
  options: Record<string, unknown>,
): ClientFeature[] => {
  const found: ClientFeature[] = []
  if (options.enableSorting === true && !options.manualSorting) {
    found.push('sorting')
  }
  if (options.enableColumnFilters === true && !options.columnFilteringServer) {
    found.push('filtering')
  }
  if (options.enableGlobalFilter === true && !options.quickSearchServer) {
    found.push('search')
  }
  if (options.enableGrouping === true) {
    found.push('grouping')
  }
  return found
}

/** Dev-warn о клиентской обработке: плагин работает, но видит только загруженное. */
export const warnClientRowModel = (table: unknown) => {
  const { options } = table as ScrollTable
  if (
    options.enableInfiniteScroll !== true ||
    infiniteScrollInertReason(table)
  ) {
    return
  }
  for (const feature of clientRowModelFeatures(options)) {
    logWarn(
      table as never,
      `infiniteScroll: client-side ${feature} only sees loaded rows; use server mode`,
      `infiniteScroll:client:${feature}`,
    )
  }
}
