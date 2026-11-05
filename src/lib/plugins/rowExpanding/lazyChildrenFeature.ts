/**
 * Ленивые дети строк (ADR 0054): срез `loadedChildren` — последний ответ
 * `loadChildren` по id строки, срез `rowExpandFailed` — номер последней неудачной
 * попытки (ключ вспышки тоггла). Методы таблицы `setLoadedChildren` /
 * `resetLoadedChildren` — для приложения.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import { type FailedAttempts, withoutGone } from '../../shared/failedAttempts'
import { announcerLabels } from '../../core/announcer'
import { mirrorFailures } from '../../core/failures/failuresFeature'
import { ENGLISH_LABELS } from '../../core/localization'
import { rejectionText } from '../../util/thenable'
import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import { rowExpandingLabels } from './labels'

export type LoadedChildren = Record<string, readonly unknown[]>
/** Отказы раскрытия: строка → попытка и ошибка (отметка на тоггле, ADR 0136). */
export type RowExpandFailed = FailedAttempts

interface LazyChildrenStateSlice {
  loadedChildren: LoadedChildren
  rowExpandFailed: RowExpandFailed
}
interface LazyChildrenOptions {
  onLoadedChildrenChange?: (updater: Updater<LoadedChildren>) => void
  onRowExpandFailedChange?: (updater: Updater<RowExpandFailed>) => void
}
export interface LazyChildrenTableAPI<TData = unknown> {
  /**
   * Заменить сохранённый ответ `loadChildren` строки (раскрытой или свёрнутой): после
   * правки ребёнка или обновления кэша приложения. Для строки без ответа — ничего.
   */
  setLoadedChildren: (rowId: string, rows: Updater<readonly TData[]>) => void
  /** Удалить ответ строки (без аргумента — все ответы); строка без ответа сворачивается. */
  resetLoadedChildren: (rowId?: string) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    rowExpandingLazyFeature: TableFeature
  }
  interface TableState_FeatureMap {
    rowExpandingLazyFeature: LazyChildrenStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowExpandingLazyFeature: LazyChildrenOptions
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    rowExpandingLazyFeature: LazyChildrenTableAPI<TData>
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

type Atom<T> = { get: () => T; set: (value: T) => void }

export interface LazyTable {
  atoms: {
    loadedChildren?: Atom<LoadedChildren>
    rowExpandFailed?: Atom<RowExpandFailed>
    expanded?: { get: () => unknown }
  }
  options: LazyChildrenOptions
  setExpanded: (updater: Updater<unknown>) => void
  updateLazySlice: (key: LazySliceKey, updater: Updater<unknown>) => void
}

type LazySliceKey = 'loadedChildren' | 'rowExpandFailed'

const HANDLERS = {
  loadedChildren: 'onLoadedChildrenChange',
  rowExpandFailed: 'onRowExpandFailedChange',
} as const

const EMPTY = {}

// Запись — методом таблицы: он замыкает ядро, а у объекта React-адаптера (его получает
// `reconcile`) в `options` нет дефолтных обработчиков фичи.
const writeSlice = <T>(
  table: LazyTable,
  key: LazySliceKey,
  updater: Updater<T>,
) => table.updateLazySlice(key, updater as Updater<unknown>)

export const readLoadedChildren = (table: unknown): LoadedChildren =>
  (table as LazyTable).atoms.loadedChildren?.get() ?? EMPTY

export const setLoadedAnswer = (
  table: unknown,
  updater: Updater<LoadedChildren>,
) => writeSlice(table as LazyTable, 'loadedChildren', updater)

/** Срез отказов раскрытия и его зеркало в реестре отказов (ADR 0177, OB13). */
const writeExpandFailed = (
  table: unknown,
  updater: (prev: RowExpandFailed) => RowExpandFailed,
) => {
  const atom = (table as LazyTable).atoms.rowExpandFailed
  const prev = atom?.get() ?? {}
  writeSlice<RowExpandFailed>(table as LazyTable, 'rowExpandFailed', updater)
  mirrorFailures(table, prev, atom?.get() ?? prev, (id, failed) => {
    const labels = announcerLabels(table) ?? ENGLISH_LABELS
    return {
      action: { plugin: 'rowExpanding', action: 'toggleRow' },
      target: { row: id },
      reason:
        rejectionText(failed.error) ??
        rowExpandingLabels(labels).loadChildrenFailed,
    }
  })
}

export const markExpandFailed = (
  table: unknown,
  rowId: string,
  attempt: number,
  error: unknown,
) =>
  writeExpandFailed(table, prev => ({
    ...prev,
    [rowId]: { attempt, error },
  }))

/** Снять отметку отказа строки: повтор или уход строки (IR13, IR14). */
export const clearExpandFailed = (
  table: unknown,
  exists: (rowId: string) => boolean,
) => {
  const failed = (table as LazyTable).atoms.rowExpandFailed?.get()
  if (!failed || Object.keys(failed).length === 0) return
  writeExpandFailed(table, prev => withoutGone(prev, exists))
}

/** Свернуть строки, у которых не осталось ответа (срез `expanded: true` не трогаем). */
export const collapseRows = (table: unknown, rowIds: readonly string[]) => {
  ;(table as LazyTable).setExpanded((prev: unknown) => {
    if (prev === true || !prev || typeof prev !== 'object') {
      return prev
    }
    const next = { ...(prev as Record<string, boolean>) }
    rowIds.forEach(id => delete next[id])
    return next
  })
}

export const rowExpandingLazyFeature: TableFeature = {
  getInitialState: state => ({
    loadedChildren: EMPTY,
    rowExpandFailed: EMPTY,
    ...state,
  }),
  getDefaultTableOptions: table => ({
    onLoadedChildrenChange: makeStateUpdater('loadedChildren', table),
    onRowExpandFailedChange: makeStateUpdater('rowExpandFailed', table),
  }),
  constructTableAPIs: table => {
    const lazy = table as unknown as LazyTable
    assignTableAPIs('rowExpandingLazyFeature', table, {
      table_updateLazySlice: {
        fn: (key: LazySliceKey, updater: Updater<unknown>) => {
          const handler = lazy.options[HANDLERS[key]] as
            ((updater: Updater<unknown>) => void) | undefined
          if (handler) {
            handler(updater as never)
            return
          }
          const atom = lazy.atoms[key] as Atom<unknown> | undefined
          atom?.set(functionalUpdate(updater, atom.get()))
        },
      },
      table_setLoadedChildren: {
        fn: (rowId: string, rows: Updater<readonly unknown[]>) =>
          setLoadedAnswer(lazy, prev =>
            rowId in prev
              ? { ...prev, [rowId]: functionalUpdate(rows, prev[rowId]!) }
              : prev,
          ),
      },
      table_resetLoadedChildren: {
        fn: (rowId?: string) => {
          const loaded = readLoadedChildren(lazy)
          const ids =
            rowId === undefined
              ? Object.keys(loaded)
              : rowId in loaded
                ? [rowId]
                : []
          if (ids.length === 0) {
            return
          }
          setLoadedAnswer(lazy, prev => {
            const next = { ...prev }
            ids.forEach(id => delete next[id])
            return next
          })
          collapseRows(lazy, ids)
        },
      },
    })
  },
}
