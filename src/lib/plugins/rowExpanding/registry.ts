/**
 * Запись плагина rowExpanding (ADR 0015/0022). Поведение даёт `rowExpandingFeature`
 * + слот `expandedRowModel`. Табличная опция `getRowCanExpand` ПОЛНОСТЬЮ заменяет
 * дефолт, поэтому проверку `subRows` включаем сами; гейт группировки (ADR 0022) —
 * там же.
 */
import {
  createExpandedRowModel,
  rowExpandingFeature,
} from '@tanstack/react-table'

import type { Row } from '../../types'
import type { ServiceColumn } from '../../core/createColumns'
import type { TesseraFeatureEntry } from '../../core/features'
import {
  COLUMN_EXPANDING_ID,
  getRowExpandingColumn,
} from './rowExpandingColumn'
import type { RowExpandingPluginParams } from './types'

export const DEFAULT_MAX_EXPANDING_DEPTH = 1

export interface RowExpandingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /**
   * Сколько уровней дерева раскрываемы от корня (ЧИСЛО уровней, не индекс): строка
   * раскрываема, пока `row.depth < maxDepth`. По умолчанию 1 — тоггл только у корней.
   */
  maxDepth?: number
  /** Бизнес-колбэк раскрытия строки (аргумент фабрики, ADR 0027); читается живо. */
  onExpandRow?: RowExpandingPluginParams['onExpandRow']
}

export const rowExpanding = (opts: RowExpandingOptions = {}) => {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH

  /**
   * В v9 `getRowCanExpand` замещает дефолт целиком, поэтому воспроизводим его
   * (`subRows.length > 0`) и добавляем ограничение по глубине. При активной
   * группировке раскрытием владеет rowGrouping (ADR 0022): глубина игнорируется,
   * возвращаем дефолтную раскрываемость.
   */
  const getRowCanExpand = (row: Row<any, any>): boolean => {
    const canDefault = !!row.subRows.length

    const groupingActive =
      ((
        (
          row.table as unknown as {
            atoms: { grouping?: { get: () => unknown[] } }
          }
        ).atoms.grouping?.get() ?? []
      ).length ?? 0) > 0

    if (groupingActive) {
      // TODO(rowGrouping): dev-warn об игнорировании maxExpandingDepth (ADR 0022).
      return canDefault
    }

    return canDefault && row.depth < maxDepth
  }

  return {
    id: 'rowExpanding',
    enabled: opts.enabled,
    slot: {
      rowExpandingFeature,
      expandedRowModel: createExpandedRowModel(),
    },
    hooks: {
      rowExpanding: opts.onExpandRow ? { onExpandRow: opts.onExpandRow } : {},
    },
    column: {
      id: COLUMN_EXPANDING_ID,
      make: getRowExpandingColumn,
      side: 'leading',
      order: 2,
      pin: { side: 'start', when: 'with-user' },
    } satisfies ServiceColumn,
    options: {
      enableExpanding: opts.enabled !== false,
      autoResetExpanded: false,
      getRowCanExpand,
    },
  } satisfies TesseraFeatureEntry<{
    rowExpandingFeature: typeof rowExpandingFeature
    expandedRowModel: ReturnType<typeof createExpandedRowModel>
  }>
}
