/**
 * Ленивые дети строк (ADR 0054): срез `loadedChildren` — последний ответ
 * `loadChildren` по id строки, срез `rowExpandFailed` — номер последней неудачной
 * попытки (ключ вспышки тоггла), срез `rowArrivals` — момент прихода новых детей
 * (ADR 0056). Методы таблицы `setLoadedChildren` /
 * `resetLoadedChildren` — для приложения.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'

export type LoadedChildren = Record<string, readonly unknown[]>
export type RowExpandFailed = Record<string, number>
/** Момент прихода строки (`performance.now()`) по её id. */
export type RowArrivals = Record<string, number>

interface LazyChildrenStateSlice {
  loadedChildren: LoadedChildren
  rowExpandFailed: RowExpandFailed
  rowArrivals: RowArrivals
}
interface LazyChildrenOptions {
  onLoadedChildrenChange?: (updater: Updater<LoadedChildren>) => void
  onRowExpandFailedChange?: (updater: Updater<RowExpandFailed>) => void
  onRowArrivalsChange?: (updater: Updater<RowArrivals>) => void
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
    rowArrivals?: Atom<RowArrivals>
    expanded?: { get: () => unknown }
  }
  options: LazyChildrenOptions
  setExpanded: (updater: Updater<unknown>) => void
  updateLazySlice: (key: LazySliceKey, updater: Updater<unknown>) => void
}

type LazySliceKey = 'loadedChildren' | 'rowExpandFailed' | 'rowArrivals'

const HANDLERS = {
  loadedChildren: 'onLoadedChildrenChange',
  rowExpandFailed: 'onRowExpandFailedChange',
  rowArrivals: 'onRowArrivalsChange',
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

export const readRowArrivals = (table: unknown): RowArrivals =>
  (table as LazyTable).atoms.rowArrivals?.get() ?? EMPTY

export const setRowArrivals = (table: unknown, updater: Updater<RowArrivals>) =>
  writeSlice(table as LazyTable, 'rowArrivals', updater)

export const markExpandFailed = (
  table: unknown,
  rowId: string,
  attempt: number,
) =>
  writeSlice<RowExpandFailed>(table as LazyTable, 'rowExpandFailed', prev => ({
    ...prev,
    [rowId]: attempt,
  }))

/** Свернуть строки, у которых не осталось ответа (срез `expanded: true` не трогаем). */
const collapse = (table: LazyTable, rowIds: readonly string[]) => {
  table.setExpanded((prev: unknown) => {
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
    rowArrivals: EMPTY,
    ...state,
  }),
  getDefaultTableOptions: table => ({
    onLoadedChildrenChange: makeStateUpdater('loadedChildren', table),
    onRowExpandFailedChange: makeStateUpdater('rowExpandFailed', table),
    onRowArrivalsChange: makeStateUpdater('rowArrivals', table),
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
          collapse(lazy, ids)
        },
      },
    })
  },
}
