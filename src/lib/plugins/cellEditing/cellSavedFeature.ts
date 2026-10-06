/**
 * Отметки сохранения ячеек (ADR 0057, §3): срез `cellSaved` — момент успешного
 * асинхронного сохранения по ключу ячейки; ячейка с отметкой подсвечена, пока не
 * выйдет `--tsr-comp-cell-saved-duration`.
 */
import {
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'

import { createExpiringMarks, type Marks } from '../../core/expiringMarks'
import type { RowData, TableFeature, TableFeatures, Updater } from '../../types'

interface CellSavedOptions {
  onCellSavedChange?: (updater: Updater<Marks>) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    cellSavedFeature: TableFeature
  }
  interface TableState_FeatureMap {
    cellSavedFeature: { cellSaved: Marks }
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    cellSavedFeature: CellSavedOptions
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    cellSavedFeature: {
      /** Внутреннее: запись среза через ядро таблицы (у объекта адаптера нет обработчика). */
      updateCellSaved: (updater: Updater<Marks>) => void
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

interface SavedTable {
  atoms: { cellSaved?: { get: () => Marks; set: (value: Marks) => void } }
  options: CellSavedOptions
  updateCellSaved: (updater: Updater<Marks>) => void
}

const EMPTY: Marks = {}

export const readCellSaved = (table: unknown): Marks =>
  (table as SavedTable).atoms.cellSaved?.get() ?? EMPTY

const writeCellSaved = (table: unknown, updater: (prev: Marks) => Marks) =>
  (table as SavedTable).updateCellSaved?.(updater)

export const cellSavedFeature: TableFeature = {
  getInitialState: state => ({ cellSaved: EMPTY, ...state }),
  getDefaultTableOptions: table => ({
    onCellSavedChange: makeStateUpdater('cellSaved', table),
  }),
  constructTableAPIs: table => {
    const saved = table as unknown as SavedTable
    assignTableAPIs('cellSavedFeature', table, {
      table_updateCellSaved: {
        fn: (updater: Updater<Marks>) => {
          if (saved.options.onCellSavedChange) {
            saved.options.onCellSavedChange(updater)
            return
          }
          const atom = saved.atoms.cellSaved
          atom?.set(functionalUpdate(updater, atom.get()))
        },
      },
    })
  },
}

const marks = createExpiringMarks({
  read: readCellSaved,
  write: writeCellSaved,
  token: '--tsr-comp-cell-saved-duration',
  fallback: 300,
})

/** Отметить сохранённую ячейку моментом «сейчас». */
export const markCellSaved = (table: unknown, key: string) =>
  marks.mark(table, [key])

/** Снять отметки ячеек (ушедших из данных или выключенного плагина). */
export const dropCellSaved = marks.drop
