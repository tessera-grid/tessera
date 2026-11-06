/**
 * Срез серверных действий (ADR 0116): ожидание и отказ запроса, который задают
 * сортировка, фильтры, поиск и страница серверного режима. Живёт в TanStack Store:
 * причина ожидания может уйти из окна виртуализации и вернуться.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'

/** Срез, который меняет серверное действие. */
/**
 * `copy` — копирование выделения с догрузкой строк (ADR 0146), `selectPage` — выбор страницы с
 * догрузкой (ADR 0188): только отказ, без отката.
 */
export type ServerActionKind =
  | 'sorting'
  | 'filtering'
  | 'search'
  | 'pagination'
  | 'grouping'
  | 'copy'
  | 'selectPage'

/** Контрол, начавший действие: на нём свет ожидания и вспышка отказа (ADR 0116, §3). */
export interface ServerActionCause {
  /** Id действия заголовка (`columnSorting`, `columnFiltering`) или контрола панели. */
  control: string
  /** Колонки действия заголовка. */
  columns?: readonly string[]
  /** Выбрано в кебабе: свет на кебабе колонки, а не на кнопке. */
  menu?: boolean
}

export interface ServerActionStatus {
  /** Действие, чей промис грид ждёт. */
  pending?: {
    kind: ServerActionKind
    attempt: number
    cause?: ServerActionCause
  }
  /** Последний отказ; снимается успехом следующего действия и закрытием плашки. */
  failed?: {
    kind: ServerActionKind
    attempt: number
    error: unknown
    cause?: ServerActionCause
    /** Повторить отказавшее действие с теми же аргументами. */
    retry: () => void
  }
  /**
   * Действие ждёт догрузки строк (ADR 0146, ADR 0188): плашка ожидания и Escape (ADR 0153, §5), без
   * свечения обновления. Обновления среза без этого поля его не трогают.
   */
  loadingRows?: { kind: 'copy' | 'selectPage'; since: number }
}

interface ServerActionStateSlice {
  serverAction: ServerActionStatus
}
interface ServerActionOptions {
  onServerActionChange?: (updater: Updater<ServerActionStatus>) => void
}
interface ServerActionTableAPI {
  setServerAction: (updater: Updater<ServerActionStatus>) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    serverActionFeature: TableFeature
  }
  interface TableState_FeatureMap {
    serverActionFeature: ServerActionStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    serverActionFeature: ServerActionOptions
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    serverActionFeature: ServerActionTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

type StatusAtom = {
  get: () => ServerActionStatus
  set: (value: ServerActionStatus) => void
}

type StatusTable = { atoms: { serverAction?: StatusAtom } }

const IDLE: ServerActionStatus = {}

export const serverActionFeature: TableFeature = {
  getInitialState: state => ({ serverAction: IDLE, ...state }),
  getDefaultTableOptions: table => ({
    onServerActionChange: makeStateUpdater('serverAction', table),
  }),
  constructTableAPIs: table => {
    assignTableAPIs('serverActionFeature', table, {
      table_setServerAction: {
        fn: (updater: Updater<ServerActionStatus>) => {
          const opts = table.options as ServerActionOptions
          if (opts.onServerActionChange) {
            opts.onServerActionChange(updater)
            return
          }
          const atom = (table as unknown as StatusTable).atoms.serverAction
          atom?.set(functionalUpdate(updater, atom.get()))
        },
      },
    })
  },
}

/** Текущий срез; без фичи — покой. */
export const readServerAction = (table: unknown): ServerActionStatus =>
  (table as StatusTable | undefined)?.atoms?.serverAction?.get() ?? IDLE

/** Обновить срез; без фичи — ничего. Ожидание строк меняет только тот, кто его назвал. */
export const writeServerAction = (
  table: unknown,
  updater: (prev: ServerActionStatus) => ServerActionStatus,
) =>
  (
    table as
      | { setServerAction?: (updater: Updater<ServerActionStatus>) => void }
      | undefined
  )?.setServerAction?.(prev => {
    const next = updater(prev)
    return prev.loadingRows && !('loadingRows' in next)
      ? { ...next, loadingRows: prev.loadingRows }
      : next
  })
