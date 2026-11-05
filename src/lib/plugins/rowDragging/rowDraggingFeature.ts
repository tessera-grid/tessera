/**
 * Кастомная фича rowDragging. Слайс overlay-состояния `rowDragging` + updater и
 * row-метод getCanDrag с гейтами: многоуровневая шапка, активная
 * группировка, активная сортировка, непустой фильтр или поиск (ADR 0045) — всё гасит
 * drag. grouping/sorting/фильтры читаются из
 * атомов (optional — фичи могут отсутствовать); каждая причина — dev-warn (ADR 0022).
 * Срезы `rowMoves` — переносы в ожидании промиса `onRowDragEnd`, `rowMoveFailed` —
 * номер последнего отказа строки, ключ вспышки ручки (ADR 0112).
 */
import type { FailedAttempts } from '../../shared/failedAttempts'
import { announcerLabels } from '../../core/announcer'
import { mirrorFailures } from '../../core/failures/failuresFeature'
import { mirrorPending } from '../../shared/objectPending'
import { ENGLISH_LABELS } from '../../core/localization'
import { rejectionText } from '../../util/thenable'
import {
  assignPrototypeAPIs,
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import { type LoggerHost, logWarn } from '../../util/logger'
import {
  type PluginInertReason,
  serverRowModelReason,
  warnPluginInert,
} from '../../core/pluginDiagnostics'
import type { RowMoves } from '../../shared/rowMoves'
import type { RowDraggingOptions as RowDraggingArgs } from './registry'
import type {
  RowData,
  Table,
  TableFeature,
  TableFeatures,
  Updater,
} from '../../types'
import {
  DEFAULT_ROW_DRAG_OVERLAY_STATE,
  type RowDragOverlayState,
} from './types'
import { rowDraggingLabels } from './labels'

/** Отказы переноса: строка → попытка и ошибка (отметка на ручке, ADR 0136). */
export type RowMoveFailed = FailedAttempts

interface RowDraggingStateSlice {
  rowDragging: RowDragOverlayState
  rowMoves: RowMoves
  rowMoveFailed: RowMoveFailed
}
interface RowDraggingOptions {
  enableRowDragging?: boolean | ((row: unknown) => boolean)
  rowDragRevertOnReject?: boolean
  /** Приложение задало `onRowDragEnd`: хуки дополнены пустым, по ним это не узнать. */
  rowDragReportsMoves?: boolean
  onRowOrderChange?: RowDraggingArgs['onRowOrderChange']
  /** Пауза над свёрнутой группой до её раскрытия, мс (ADR 0109). */
  rowDragExpandDelay?: number
  onRowDraggingChange?: (updater: Updater<RowDragOverlayState>) => void
  onRowMovesChange?: (updater: Updater<RowMoves>) => void
  onRowMoveFailedChange?: (updater: Updater<RowMoveFailed>) => void
}
interface RowDraggingRowAPI {
  getCanDrag: () => boolean
}
interface RowDraggingTableAPI {
  setRowDragging: (updater: Updater<RowDragOverlayState>) => void
  setRowMoves: (updater: Updater<RowMoves>) => void
  setRowMoveFailed: (updater: Updater<RowMoveFailed>) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    rowDraggingFeature: TableFeature
  }
  interface TableState_FeatureMap {
    rowDraggingFeature: RowDraggingStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowDraggingFeature: RowDraggingOptions
  }
  interface Row_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowDraggingFeature: RowDraggingRowAPI
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowDraggingFeature: RowDraggingTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

type DraggableTable = {
  options: {
    enableRowDragging?: boolean | ((row: unknown) => boolean)
    /** Приложение задало `onRowDragEnd`: хуки дополнены пустым, по ним это не узнать. */
    rowDragReportsMoves?: boolean
  }
  getHeaderGroups: () => unknown[]
  atoms: {
    grouping?: { get: () => unknown[] }
    sorting?: { get: () => unknown[] }
    columnFilters?: { get: () => unknown[] }
    globalFilter?: { get: () => unknown }
  }
}

type DraggableRow = {
  table: DraggableTable
  getParentRow: () => { getIsLazyParent?: () => boolean } | undefined
  /** Колонка строки-группы серверной группировки. */
  groupingColumnId?: string
}

/** Ленивый перенос без `onRowDragEnd` недопустим (ADR 0112, §2). */
export const canMoveInLazyTree = (table: unknown) =>
  !!(table as DraggableTable).options.rowDragReportsMoves

export const warnLazyTree = (table: unknown) =>
  logWarn(
    table as LoggerHost,
    'rowDragging: перенос в ленивом дереве требует onRowDragEnd — ленивые дети не тянутся, вложение в ленивую группу недопустимо',
    'rowDragging:lazyTree',
  )

/**
 * Группировка / сортировка / фильтр гасят drag (вложенная шапка — нет, ADR 0052). В
 * серверной модели строк — сортировка и фильтр: порядком владеет сервер (ADR 0159, §1).
 */
export const rowDraggingInertReason = (
  table: unknown,
): PluginInertReason | undefined => {
  const t = table as DraggableTable
  // Лист переносится между группами: серверными (ADR 0159, §5) и клиентскими, если приложению
  // есть чем записать значение (ADR 0186, §1).
  if (
    (t.atoms.grouping?.get() ?? []).length > 0 &&
    !serverRowModelReason(table) &&
    !canMoveInLazyTree(table)
  ) {
    return 'grouping'
  }
  if ((t.atoms.sorting?.get() ?? []).length > 0) {
    return 'sorting'
  }
  // Порядок отфильтрованного вида ненастоящий: перестановка в нём бессмысленна.
  const search = t.atoms.globalFilter?.get()
  if (
    (t.atoms.columnFilters?.get() ?? []).length > 0 ||
    (typeof search === 'string' && search.trim() !== '')
  ) {
    return 'filtering'
  }
  return undefined
}

export const canDragRow = (row: DraggableRow): boolean => {
  const enable = row.table.options.enableRowDragging
  const wantsDrag = typeof enable === 'function' ? enable(row) : !!enable

  if (!wantsDrag) {
    return false
  }
  const reason = rowDraggingInertReason(row.table)
  if (reason !== undefined) {
    warnPluginInert(row.table, 'rowDragging', reason)
    return false
  }
  // Строки-группы не переносятся (ADR 0159, §5).
  if (row.groupingColumnId !== undefined) {
    return false
  }
  if (
    // Ветки серверной модели переносятся транзакцией источника, не стадией модели.
    !serverRowModelReason(row.table) &&
    row.getParentRow()?.getIsLazyParent?.() &&
    !canMoveInLazyTree(row.table)
  ) {
    warnLazyTree(row.table)
    return false
  }
  return true
}

const NO_MOVES: RowMoves = {}
const NO_FAILS: RowMoveFailed = {}

type SliceAtom<T> = { get: () => T; set: (value: T) => void }

/** Сеттер среза: обработчик опций, иначе атом напрямую. */
const sliceSetter =
  <T>(
    table: unknown,
    key: string,
    handler: string,
    onChange?: (prev: T, next: T) => void,
  ) =>
  (updater: Updater<T>) => {
    const own = (table as { options: Record<string, unknown> }).options[
      handler
    ] as ((u: Updater<T>) => void) | undefined
    const atom = (table as { atoms: Record<string, SliceAtom<T> | undefined> })
      .atoms[key]
    const prev = atom?.get()
    if (own) own(updater)
    else atom?.set(functionalUpdate(updater, atom.get()))
    if (onChange && atom && prev !== undefined) onChange(prev, atom.get())
  }

export const rowDraggingFeature: TableFeature = {
  getInitialState: state => ({
    rowDragging: DEFAULT_ROW_DRAG_OVERLAY_STATE,
    rowMoves: NO_MOVES,
    rowMoveFailed: NO_FAILS,
    ...state,
  }),
  getDefaultTableOptions: table => ({
    onRowDraggingChange: makeStateUpdater('rowDragging', table),
    onRowMovesChange: makeStateUpdater('rowMoves', table),
    onRowMoveFailedChange: makeStateUpdater('rowMoveFailed', table),
  }),
  constructTableAPIs: table => {
    // v9 useTable возвращает фасад с сырыми options (без фичевых defaults), поэтому
    // grid-редьюсер не может звать table.options.onRowDraggingChange напрямую —
    // даём метод-сеттер, который бьёт по ВНУТРЕННЕму (default) updater/атому.
    assignTableAPIs('rowDraggingFeature', table, {
      table_setRowDragging: {
        fn: (updater: Updater<RowDragOverlayState>) => {
          const opts = (table as Table<any, any>).options
          if (opts.onRowDraggingChange) {
            opts.onRowDraggingChange(updater)
            return
          }
          // Фолбэк: пишем атом напрямую (если default по какой-то причине отсутствует).
          const atom = (
            table as unknown as {
              atoms: {
                rowDragging: {
                  get: () => RowDragOverlayState
                  set: (v: RowDragOverlayState) => void
                }
              }
            }
          ).atoms.rowDragging
          atom.set(functionalUpdate(updater, atom.get()))
        },
      },
      table_setRowMoves: {
        fn: sliceSetter<RowMoves>(
          table,
          'rowMoves',
          'onRowMovesChange',
          // Ожидание переноса — волна строки, а не дуга ручки (ADR 0177, §1).
          (prev, next) =>
            mirrorPending(table, 'rowMove', prev, next, (id, move) =>
              move.pending ? [{ row: id }] : undefined,
            ),
        ),
      },
      table_setRowMoveFailed: {
        fn: sliceSetter<RowMoveFailed>(
          table,
          'rowMoveFailed',
          'onRowMoveFailedChange',
          (prev, next) =>
            mirrorFailures(table, prev, next, (id, failed) => {
              const labels = announcerLabels(table) ?? ENGLISH_LABELS
              return {
                action: { plugin: 'rowDragging', action: 'drag' },
                target: { row: id },
                reason:
                  rejectionText(failed.error) ??
                  rowDraggingLabels(labels).moveRowFailed,
              }
            }),
        ),
      },
    })
  },
  assignRowPrototype: (prototype, table) => {
    assignPrototypeAPIs('rowDraggingFeature', prototype, table, {
      row_getCanDrag: {
        fn: (row: DraggableRow) => canDragRow(row),
      },
    })
  },
}
