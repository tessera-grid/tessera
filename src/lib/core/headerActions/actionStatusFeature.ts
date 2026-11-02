/**
 * Состояние долгих действий меню (ADR 0078): срез `actionStatus` — ожидание и отказ
 * `onSelect` по ключу «цель + действие». Живёт в TanStack Store, а не в кебабе: строка
 * уходит из окна виртуализации, а ожидание остаётся.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import type { FlashTarget } from '../highlights/highlightFeature'
import { cancelPending, type CancelPendingFilter } from '../cancellation'
import { reportAction } from '../debugActions'
import type { TableLabels } from '../localization'
import type { MenuAction } from './types'
import { trackCellAction, type TrackCellActionOptions } from './cellActions'

export interface ActionStatusEntry {
  /** Действие записи — для имени на кебабе (пункт раздела в корне меню не виден). */
  action?: MenuAction
  /** Запущено из меню: состояние видно на кебабе. */
  menu?: boolean
  /** Действие ждёт своего промиса. */
  pending?: boolean
  /** Цель действия: пока оно ждёт, её ячейки несут `aria-busy` (ADR 0152, §3). */
  target?: readonly FlashTarget[]
  /** Инициатора не видно (контекстное меню): ожидание — волной на цели (ADR 0155, §1). */
  wave?: boolean
  /** Действие меняет всю таблицу: свечение под шапкой, отказ — плашкой (ADR 0155, §2). */
  table?: boolean
  /** Имя, причина отказа для плашки и повтор действия — у действия всей таблицы. */
  name?: (labels: TableLabels) => string
  reason?: (labels: TableLabels) => string
  retry?: () => void
  /** Плашку отказа закрыли; отметка на кебабе остаётся. */
  dismissed?: boolean
  /** Отказ: отметка на кнопке, кебабе и иконка в пункте — до повтора или успеха. */
  failed?: boolean
  error?: unknown
  /** Отказ уже показан в открытом меню. */
  seen?: boolean
}

export type ActionStatus = Record<string, ActionStatusEntry>

interface ActionStatusStateSlice {
  actionStatus: ActionStatus
}
interface ActionStatusOptions {
  onActionStatusChange?: (updater: Updater<ActionStatus>) => void
}
interface ActionStatusTableAPI {
  setActionStatus: (updater: Updater<ActionStatus>) => void
  /**
   * Отменить ждущие операции — все или по виду и id (ADR 0153, §7); итог тихий, как у
   * отмены человеком.
   */
  cancelPending: (filter?: CancelPendingFilter) => void
  /**
   * Ожидание промиса на ячейке, строке, колонке или диапазоне и его итог (ADR 0176):
   * `indicator: 'cell'` — волна на ячейках, `'control'` — ожидание рисует контрол сам.
   */
  trackCellAction: <T>(
    target: FlashTarget | readonly FlashTarget[],
    promise: Promise<T> | T,
    options?: TrackCellActionOptions,
  ) => Promise<T>
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    actionStatusFeature: TableFeature
  }
  interface TableState_FeatureMap {
    actionStatusFeature: ActionStatusStateSlice
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    actionStatusFeature: ActionStatusOptions
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    actionStatusFeature: ActionStatusTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

type StatusAtom = {
  get: () => ActionStatus
  set: (value: ActionStatus) => void
}

type StatusTable = { atoms: { actionStatus?: StatusAtom } }

const EMPTY: ActionStatus = {}

export const actionStatusFeature: TableFeature = {
  getInitialState: state => ({ actionStatus: EMPTY, ...state }),
  getDefaultTableOptions: table => ({
    onActionStatusChange: makeStateUpdater('actionStatus', table),
  }),
  constructTableAPIs: table => {
    assignTableAPIs('actionStatusFeature', table, {
      table_setActionStatus: {
        fn: (updater: Updater<ActionStatus>) => {
          const opts = table.options as ActionStatusOptions
          if (opts.onActionStatusChange) {
            opts.onActionStatusChange(updater)
            return
          }
          const atom = (table as unknown as StatusTable).atoms.actionStatus
          atom?.set(functionalUpdate(updater, atom.get()))
        },
      },
      table_trackCellAction: {
        fn: <T>(
          target: FlashTarget | readonly FlashTarget[],
          promise: Promise<T> | T,
          options?: TrackCellActionOptions,
        ) => trackCellAction(table, target, promise, options),
      },
      table_cancelPending: {
        fn: (filter?: CancelPendingFilter) => {
          reportAction(table, {
            plugin: 'core',
            action: 'cancelPending',
            detail: filter,
            source: 'api',
          })
          cancelPending(table, filter, 'api')
        },
      },
    })
  },
}

/** Текущий срез; без фичи — пустой. */
export const readActionStatus = (table: unknown): ActionStatus =>
  (table as StatusTable | undefined)?.atoms?.actionStatus?.get() ?? EMPTY

/** Обновить срез; без фичи — ничего. */
export const writeActionStatus = (
  table: unknown,
  updater: (prev: ActionStatus) => ActionStatus,
) =>
  (
    table as
      { setActionStatus?: (updater: Updater<ActionStatus>) => void } | undefined
  )?.setActionStatus?.(updater)
