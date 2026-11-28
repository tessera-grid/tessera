/**
 * Запись плагина rowExpanding на `definePlugin`. Поведение даёт
 * `rowExpandingFeature` + `expandedRowModel`. Табличная опция `getRowCanExpand`
 * ПОЛНОСТЬЮ заменяет дефолт, поэтому проверку `subRows` включаем сами; гейт
 * группировки — там же. Ленивые дети (ADR 0054) — своя исходная модель и срез ответов.
 */
import {
  rowExpandingFeature,
  type RowData,
  type TableFeatures,
} from '@tanstack/react-table'

import type { Row } from '../../types'
import { definePlugin } from '../../core/definePlugin'
import type {
  ServiceColumnMode,
  ServicePresence,
} from '../../core/servicePresence'
import { neverInert, warnPluginInert } from '../../core/pluginDiagnostics'
import { toggleExpandedKeyboardAction } from './keyboardActions'
import {
  createIncrementalExpandedRowModel,
  narrowExpandingOff,
} from '../../shared/rowModels/expandedRowModel'
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
import { ExpandAllComponent } from './ExpandAllComponent'
import { RowExpandingComponent } from './RowExpandingComponent'
import { isLazyRow } from './toggleRowExpanded'
import {
  rowExpandingModel,
  type RowExpandingModelOptions,
} from '../rowExpandingModel/registry'
import type { RowExpandingHooks } from './types'
import { rowExpandingLabels } from './labels'
import { ownStage } from '../../core/rowEngine/engine'
import { rowsOf } from '../../core/rowEngine/rows'

export const DEFAULT_MAX_EXPANDING_DEPTH = 1

export interface RowExpandingOptions extends Omit<
  RowExpandingModelOptions,
  'enabled'
> {
  /** `false` disables the plugin. */
  enabled?: boolean
  /**
   * How many tree levels are expandable from the root (a NUMBER of levels, not an index): a row is
   * expandable while `row.depth < maxDepth`. 1 by default — only roots have a toggle.
   */
  maxDepth?: number
  /**
   * `'auto'` (default) — the column is shown only when the data has expandable rows; `'always'` —
   * always (server mode, ADR 0050).
   */
  column?: ServiceColumnMode
  /**
   * The "Expand all / Collapse all" button in the expand column header (ADR 0160, §2); `false` —
   * expanding only per row. Shown by default.
   */
  expandAll?: boolean
  /**
   * A tree branch row stays under the header while its children are visible; nested ones stack
   * (ADR 0160, §3). Off by default.
   */
  stickyRows?: boolean
  /** Row expand business callback (a factory argument); read live. */
  onExpandRow?: RowExpandingHooks['onExpandRow']
  /** The row has children that aren't in `subRows` — `loadChildren` loads them (ADR 0054). */
  hasChildren?: RowExpandingHooks['hasChildren']
  /**
   * Loads a lazy row's children on every expand: an array — right away, a promise — after waiting.
   * The grid keeps the last answer; caching is up to the application (ADR 0054).
   */
  loadChildren?: RowExpandingHooks['loadChildren']
}

/**
 * Колонка нужна, если хоть один корень исходных данных имеет детей или помечен
 * `hasChildren` (раскрываемый потомок глубже означает раскрываемого предка), или
 * подключена группировка: группы раскрываются тогглом этой колонки, или идёт первая
 * загрузка.
 */
const hasExpandableRows: ServicePresence<RowExpandingOptions> = (
  table,
  context,
  o,
) => {
  if (context.options.enableGrouping === true) return true
  if ((o.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH) < 1) return false
  // Серверная модель строк: строк в модели нет, раскрываемы строки с `hasChildren`
  // (ADR 0138, §14); строки-группы серверной группировки — выше (ADR 0144).
  if (typeof context.options.getRowSource === 'function') return !!o.hasChildren
  // Скелет первой загрузки: данных ещё нет, включённое раскрытие держит колонку (SL25).
  if (context.options.loading === 'initial') return true
  if (!table) return undefined
  return rowsOf<Row<any, any>>(table, 'core').rows.some(
    row =>
      row.subRows.length > 0 ||
      !!o.hasChildren?.(row as unknown as Row<any, any>),
  )
}

export const rowExpanding = definePlugin<RowExpandingOptions>()({
  id: 'rowExpanding',
  labels: [rowExpandingLabels],
  actions: {
    toggleRow: labels => rowExpandingLabels(labels).actionToggleRow,
    expandRow: labels => rowExpandingLabels(labels).actionToggleRow,
    loadChildren: labels => rowExpandingLabels(labels).actionToggleRow,
    expandAll: labels => rowExpandingLabels(labels).expandAll,
    collapseAll: labels => rowExpandingLabels(labels).collapseAll,
    'rowExpanding.toggle': labels => rowExpandingLabels(labels).actionToggleRow,
  },
  diagnose: neverInert,
  // Модель дерева — своя запись; срез `expanded` — её аргумент (ADR 0120).
  model: {
    plugin: rowExpandingModel,
    keys: ['expanded', 'onExpandedChange', 'initialExpanded'],
  },
  features: {
    rowExpandingFeature,
    rowExpandingPendingFeature,
    rowExpandingLazyFeature,
    coreRowModel: createLazyCoreRowModel(),
    expandedRowModel: ownStage('expand', createIncrementalExpandedRowModel()),
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
      ? { expanded: narrowExpandingOff }
      : {
          expanded: narrowExpanded(
            o.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH,
            o.hasChildren,
          ),
        },
  column: {
    id: COLUMN_EXPANDING_ID,
    cell: RowExpandingComponent,
    header: ExpandAllComponent,
    make: getRowExpandingColumn,
    side: 'leading',
    order: 2,
    pin: { side: 'start', when: 'with-user' },
    label: labels => rowExpandingLabels(labels).expandColumn,
    controlSized: true,
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
      // Строка-группа серверной модели строк — без `subRows`: дети в ветке (ADR 0144).
      const canDefault =
        !!row.subRows.length ||
        !!(row as { getIsGrouped?: () => boolean }).getIsGrouped?.()
      // Лист без детей — большинство строк: срез группировки ему не нужен.
      const lazy =
        !canDefault && row.depth < maxDepth && isLazyRow(row, o.hasChildren)
      if (!canDefault && !lazy) {
        return false
      }

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
      return readLoadedChildren(row.table)[row.id]?.length !== 0
    }

    // Опции модели выставляет rowExpandingModel; выключенный интерфейс предела не задаёт.
    return {
      getRowCanExpand: o.enabled === false ? undefined : getRowCanExpand,
      rowExpandAllButton: o.enabled !== false && o.expandAll !== false,
      stickyBranchRows: o.enabled !== false && !!o.stickyRows,
    }
  },
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    rowExpandingPlugin: {
      rowExpandAllButton?: boolean
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
