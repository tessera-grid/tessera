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

export interface ActionStatusEntry {
  /** Действие ждёт своего промиса. */
  pending?: boolean
  /** Отказ, который держит отметку на кебабе и иконку в пункте. */
  failed?: boolean
  error?: unknown
  /** Номер последнего отказа — ключ вспышки. */
  flash?: number
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
