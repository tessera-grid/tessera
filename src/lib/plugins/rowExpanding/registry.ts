/**
 * Запись плагина rowExpanding на `definePlugin`. Поведение даёт
 * `rowExpandingFeature` + `expandedRowModel`. Табличная опция `getRowCanExpand`
 * ПОЛНОСТЬЮ заменяет дефолт, поэтому проверку `subRows` включаем сами; гейт
 * группировки — там же.
 */
import {
  createExpandedRowModel,
  rowExpandingFeature,
} from '@tanstack/react-table'

import type { Row } from '../../types'
import { definePlugin } from '../../core/definePlugin'
import { neverInert, warnPluginInert } from '../../core/pluginDiagnostics'
import { toggleExpandedKeyboardAction } from './keyboardActions'
import { narrowExpandedByDepth } from './narrowExpanded'
import { rowExpandingPendingFeature } from './rowExpandingPendingFeature'
import {
  COLUMN_EXPANDING_ID,
  getRowExpandingColumn,
} from './rowExpandingColumn'
import type { RowExpandingHooks } from './types'

export const DEFAULT_MAX_EXPANDING_DEPTH = 1

export interface RowExpandingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /**
   * Сколько уровней дерева раскрываемы от корня (ЧИСЛО уровней, не индекс): строка
   * раскрываема, пока `row.depth < maxDepth`. По умолчанию 1 — тоггл только у корней.
   */
  maxDepth?: number
  /** Бизнес-колбэк раскрытия строки (аргумент фабрики); читается живо. */
  onExpandRow?: RowExpandingHooks['onExpandRow']
}

export const rowExpanding = definePlugin<RowExpandingOptions>()({
  id: 'rowExpanding',
  diagnose: neverInert,
  features: {
    rowExpandingFeature,
    rowExpandingPendingFeature,
    expandedRowModel: createExpandedRowModel(),
  },
  hooks: o => ({ onExpandRow: o.onExpandRow }),
  keyboardActions: [toggleExpandedKeyboardAction],
  narrow: o =>
    o.enabled === false
      ? undefined
      : {
          expanded: narrowExpandedByDepth(
            o.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH,
          ),
        },
  column: {
    id: COLUMN_EXPANDING_ID,
    make: getRowExpandingColumn,
    side: 'leading',
    order: 2,
    pin: { side: 'start', when: 'with-user' },
  },
  options: o => {
    const maxDepth = o.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH

    /**
     * В v9 `getRowCanExpand` замещает дефолт целиком, поэтому воспроизводим его
     * (`subRows.length > 0`) и добавляем ограничение по глубине. При активной
     * группировке раскрытием владеет rowGrouping: глубина игнорируется,
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
        if (o.enabled !== false) {
          warnPluginInert(
            row.table,
            'rowExpanding',
            'grouping',
            'при активной группировке раскрытием владеет rowGrouping, maxDepth и enabled игнорируются',
          )
        }
        return canDefault
      }

      return canDefault && row.depth < maxDepth
    }

    return {
      enableExpanding: o.enabled !== false,
      autoResetExpanded: false,
      getRowCanExpand,
    }
  },
})
