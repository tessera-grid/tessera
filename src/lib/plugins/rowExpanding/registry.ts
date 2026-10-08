/**
 * Запись плагина rowExpanding на `definePlugin`. Поведение даёт
 * `rowExpandingFeature` + `expandedRowModel`. Табличная опция `getRowCanExpand`
 * ПОЛНОСТЬЮ заменяет дефолт, поэтому проверку `subRows` включаем сами; гейт
 * группировки — там же. Ленивые дети (ADR 0054) — своя исходная модель и срез ответов.
 */
import { rowExpandingFeature } from '@tanstack/react-table'

import type { Row } from '../../types'
import { definePlugin } from '../../core/definePlugin'
import type {
  ServiceColumnMode,
  ServicePresence,
} from '../../core/servicePresence'
import { neverInert, warnPluginInert } from '../../core/pluginDiagnostics'
import { toggleExpandedKeyboardAction } from './keyboardActions'
import { createIncrementalExpandedRowModel } from './expandedRowModel'
import { createLazyCoreRowModel } from './lazyCoreRowModel'
import {
  readLoadedChildren,
  rowExpandingLazyFeature,
} from './lazyChildrenFeature'
import { narrowExpanded } from './narrowExpanded'
import { reconcileLoadedChildren } from './reconcileLoadedChildren'
import { rowExpandingPendingFeature } from './rowExpandingPendingFeature'
import {
  COLUMN_EXPANDING_ID,
  getRowExpandingColumn,
} from './rowExpandingColumn'
import { RowExpandingComponent } from './RowExpandingComponent'
import { isLazyRow } from './toggleRowExpanded'
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
  /**
   * `'auto'` (по умолчанию) — колонка видна, только если в данных есть раскрываемые
   * строки; `'always'` — всегда (серверный режим, ADR 0050).
   */
  column?: ServiceColumnMode
  /** Бизнес-колбэк раскрытия строки (аргумент фабрики); читается живо. */
  onExpandRow?: RowExpandingHooks['onExpandRow']
  /** У строки есть дети, которых нет в `subRows`, — их грузит `loadChildren` (ADR 0054). */
  hasChildren?: RowExpandingHooks['hasChildren']
  /**
   * Загрузка детей ленивой строки на каждое раскрытие: массив — сразу, промис —
   * после ожидания. Грид держит последний ответ; кэш — на приложении (ADR 0054).
   */
  loadChildren?: RowExpandingHooks['loadChildren']
  /** Вертикальные направляющие по уровням в отступе первой колонки (ADR 0058). */
  treeLines?: boolean
}

/**
 * Колонка нужна, если хоть один корень исходных данных имеет детей или помечен
 * `hasChildren` (раскрываемый потомок глубже означает раскрываемого предка), или
 * подключена группировка: группы раскрываются тогглом этой колонки.
 */
const hasExpandableRows: ServicePresence<RowExpandingOptions> = (
  table,
  context,
  o,
) => {
  if (context.options.enableGrouping === true) return true
  if ((o.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH) < 1) return false
  if (!table) return undefined
  return table
    .getCoreRowModel()
    .rows.some(
      row =>
        row.subRows.length > 0 ||
        !!o.hasChildren?.(row as unknown as Row<any, any>),
    )
}

export const rowExpanding = definePlugin<RowExpandingOptions>()({
  id: 'rowExpanding',
  diagnose: neverInert,
  features: {
    rowExpandingFeature,
    rowExpandingPendingFeature,
    rowExpandingLazyFeature,
    coreRowModel: createLazyCoreRowModel(),
    expandedRowModel: createIncrementalExpandedRowModel(),
  },
  hooks: o => ({
    onExpandRow: o.onExpandRow,
    hasChildren: o.hasChildren,
    loadChildren: o.loadChildren,
  }),
  refreshOn: ['hasChildren'],
  reconcile: reconcileLoadedChildren,
  keyboardActions: [toggleExpandedKeyboardAction],
  narrow: o =>
    o.enabled === false
      ? undefined
      : {
          expanded: narrowExpanded(
            o.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH,
            o.hasChildren,
          ),
        },
  column: {
    id: COLUMN_EXPANDING_ID,
    cell: RowExpandingComponent,
    make: getRowExpandingColumn,
    side: 'leading',
    order: 2,
    pin: { side: 'start', when: 'with-user' },
    presence: hasExpandableRows,
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

      if (row.depth >= maxDepth) {
        return false
      }
      if (canDefault) {
        return true
      }
      // Ленивая строка; пустой ответ делает её листом до смены данных.
      return (
        isLazyRow(row, o.hasChildren) &&
        readLoadedChildren(row.table)[row.id]?.length !== 0
      )
    }

    return {
      enableExpanding: o.enabled !== false,
      autoResetExpanded: false,
      getRowCanExpand,
      enableTreeLines: o.enabled !== false && !!o.treeLines,
    }
  },
})
