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
import {
  createIncrementalExpandedRowModel,
  narrowExpandingOff,
} from '../../core/expandedRowModel'
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

export const DEFAULT_MAX_EXPANDING_DEPTH = 1

export interface RowExpandingOptions extends Omit<
  RowExpandingModelOptions,
  'enabled'
> {
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
  /**
   * Кнопка «Раскрыть всё / Свернуть всё» в шапке колонки раскрытия (ADR 0160, §2); `false` —
   * раскрытие только по строкам. По умолчанию есть.
   */
  expandAll?: boolean
  /**
   * Строка ветки дерева держится под шапкой, пока видны её дети; вложенные — стопкой
   * (ADR 0160, §3). По умолчанию выключено.
   */
  stickyRows?: boolean
  /** Бизнес-колбэк раскрытия строки (аргумент фабрики); читается живо. */
  onExpandRow?: RowExpandingHooks['onExpandRow']
  /** У строки есть дети, которых нет в `subRows`, — их грузит `loadChildren` (ADR 0054). */
  hasChildren?: RowExpandingHooks['hasChildren']
  /**
   * Загрузка детей ленивой строки на каждое раскрытие: массив — сразу, промис —
   * после ожидания. Грид держит последний ответ; кэш — на приложении (ADR 0054).
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
  // Серверная модель строк: строк в модели нет, раскрываемы строки с `hasChildren`
  // (ADR 0138, §14) и строки-группы серверной группировки (ADR 0144).
  if (typeof context.options.getRowSource === 'function') {
    return !!o.hasChildren || context.options.enableGrouping === true
  }
  if (context.options.enableGrouping === true) return true
  if ((o.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH) < 1) return false
  // Скелет первой загрузки: данных ещё нет, включённое раскрытие держит колонку (SL25).
  if (context.options.loading === 'initial') return true
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
    label: 'expandColumn',
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

    // Опции модели выставляет rowExpandingModel; выключенный интерфейс предела не задаёт.
    return {
      getRowCanExpand: o.enabled === false ? undefined : getRowCanExpand,
      rowExpandAllButton: o.enabled !== false && o.expandAll !== false,
      stickyBranchRows: o.enabled !== false && !!o.stickyRows,
    }
  },
})
