/**
 * Фича сводки колонки (ADR 0230, §1): срез `columnAggregations` (колонка → имя функции, `null` —
 * «Без сводки») и живое поле `aggregationFn` описания колонки. Поле читают TanStack, итог
 * колонок, стадия группировки и запрос сервера — без знания о плагине; новых колонок смена
 * выбора не создаёт.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'
import type { DataTypeName } from '../../core/dataTypes'

/** Колонка → имя функции; `null` — «Без сводки»; нет ключа — функция колонки. */
export type ColumnAggregationsState = Record<string, string | null>

/** Своя функция сводки: определение TanStack и подпись приложения (ADR 0230, §2). */
export interface ColumnAggregationFunction {
  /** Значение по строкам группы или всей таблицы. */
  aggregate: (context: {
    rows: readonly { getValue: (columnId: string) => unknown }[]
    getValue: (row: never) => unknown
    columnId: string
  }) => unknown
  /** Подпись в меню, у итога и в «Настройках вида» — текст приложения. */
  label: string
  /** Типы колонок, в чей список функция входит сама; без них — только где её назвали. */
  dataTypes?: readonly DataTypeName[]
}

interface ColumnAggregationTableOptions {
  onColumnAggregationsChange?: (
    updater: Updater<ColumnAggregationsState>,
  ) => void
  /** Свои функции сводки по имени. */
  columnAggregationFunctions?: Record<string, ColumnAggregationFunction>
  /** Сводку колонки можно менять; `false` — пункта нет (SU6). */
  canSummarizeColumn?: (column: { id: string; columnDef: object }) => boolean
}

interface ColumnAggregationTableAPI {
  /** Выбор функций колонок из кода (ADR 0230, SU10). */
  setColumnAggregations: (updater: Updater<ColumnAggregationsState>) => void
}

export interface ColumnAggregationColumnDef {
  /** Функции, которые пользователь выбирает в сводке колонки; главнее списка типа (SU3). */
  aggregationFns?: readonly string[]
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    columnAggregationFeature: TableFeature
  }
  interface TableState_FeatureMap {
    columnAggregationFeature: { columnAggregations: ColumnAggregationsState }
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    columnAggregationFeature: ColumnAggregationTableOptions
  }
  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    in out TValue,
  > {
    columnAggregationFeature: ColumnAggregationColumnDef
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    columnAggregationFeature: ColumnAggregationTableAPI
  }
}

declare module '../../core/dataTypes' {
  interface DataTypeFields<TData> {
    /** Функции сводки колонок типа (ADR 0230, §2). */
    aggregationFns?: readonly string[]
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const NONE: ColumnAggregationsState = {}

interface AggregationTable {
  atoms: { columnAggregations?: { get: () => ColumnAggregationsState } }
  options: ColumnAggregationTableOptions
}

/** Функция колонки до выбора пользователя — `aggregationFn` её описания. */
const defaults = new WeakMap<object, unknown>()

export const defaultAggregationOf = (column: { columnDef: object }): unknown =>
  defaults.get(column.columnDef)

/** Выбор колонки в срезе: `undefined` — выбора нет, `null` — «Без сводки». */
export const chosenAggregationOf = (
  table: unknown,
  columnId: string,
): string | null | undefined => {
  const choice = (table as AggregationTable).atoms.columnAggregations?.get()
  return choice && Object.hasOwn(choice, columnId)
    ? choice[columnId]
    : undefined
}

/** Своя функция сводки — определение TanStack с именем для запроса сервера. */
const customDefinitions = new WeakMap<
  ColumnAggregationFunction,
  { aggregate: unknown; name: string }
>()

const definitionOf = (name: string, custom: ColumnAggregationFunction) => {
  let definition = customDefinitions.get(custom)
  if (!definition) {
    definition = { aggregate: custom.aggregate, name }
    customDefinitions.set(custom, definition)
  }
  return definition
}

export const columnAggregationFeature: TableFeature = {
  getInitialState: state => ({ columnAggregations: NONE, ...state }),
  getDefaultTableOptions: table => ({
    onColumnAggregationsChange: makeStateUpdater('columnAggregations', table),
  }),
  constructTableAPIs: table => {
    assignTableAPIs('columnAggregationFeature', table, {
      table_setColumnAggregations: {
        fn: (updater: Updater<ColumnAggregationsState>) => {
          const options = (table as unknown as AggregationTable).options
          if (options.onColumnAggregationsChange) {
            options.onColumnAggregationsChange(updater)
            return
          }
          const atom = (
            table as unknown as {
              atoms: {
                columnAggregations: {
                  get: () => ColumnAggregationsState
                  set: (value: ColumnAggregationsState) => void
                }
              }
            }
          ).atoms.columnAggregations
          atom.set(functionalUpdate(updater, atom.get()))
        },
      },
    })
  },
  // Описание колонки у TanStack своё на каждую сборку: поле ставится на него, а не на
  // описание приложения.
  initColumnInstanceData: column => {
    const target = column as unknown as {
      id: string
      columnDef: Record<string, unknown>
      table: AggregationTable
    }
    const def = target.columnDef
    defaults.set(def, def.aggregationFn)
    Object.defineProperty(def, 'aggregationFn', {
      configurable: true,
      enumerable: true,
      get: () => {
        const chosen = chosenAggregationOf(target.table, target.id)
        if (chosen === undefined) return defaults.get(def)
        if (chosen === null) return undefined
        const custom = target.table.options.columnAggregationFunctions?.[chosen]
        return custom ? definitionOf(chosen, custom) : chosen
      },
      set: (value: unknown) => {
        defaults.set(def, value)
      },
    })
  },
}
