/**
 * API истории правок у таблицы (ADR 0222, §14): отмена, повтор, переход к записи, своя запись
 * приложения, чтение и сброс.
 */
import { assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../../types'
import {
  type AppHistoryEntry,
  type EditHistoryChange,
  type EditHistorySource,
  type EditHistoryState,
  canRedo,
  canUndo,
  clearHistory,
  historyOf,
  pushHistory,
  rewind,
  step,
} from './history'

interface EditHistoryTableAPI {
  /** Отменить последнюю выполненную запись; `true` — шаг сделан. */
  undo: () => Promise<boolean>
  /** Повторить последнюю отменённую запись. */
  redo: () => Promise<boolean>
  canUndo: () => boolean
  canRedo: () => boolean
  /** Откатить или повторить до записи с этим id. */
  /** `null` — откат всех записей, к виду до первой правки. */
  rewindHistory: (entryId: string | null) => Promise<boolean>
  clearHistory: () => void
  getHistory: () => EditHistoryState
  /** Положить свою запись приложения; возвращает её id. */
  pushHistory: (entry: AppHistoryEntry) => string | undefined
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    editHistoryFeature: TableFeature
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    editHistoryFeature: EditHistoryTableAPI
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    editHistoryFeature: {
      /** Виды изменений, которые история пишет (ADR 0222, §16); не задано — все. */
      editHistorySources?: readonly EditHistorySource[]
      /** Пишется ли изменение (§16). */
      editHistoryCanRecordChange?: (change: EditHistoryChange) => boolean
      /** Предел записей истории (ADR 0222, §2). */
      editHistoryLimit?: number
      /** Ячеек во всех записях истории (ADR 0223, §4). */
      editHistoryMaxCells?: number
      /** Конфликт при отмене: пропустить ячейку или писать поверх (§6). */
      editHistoryConflict?: 'skip' | 'overwrite'
      /** Пункты «Отменить» и «Повторить» в контекстном меню (§11). */
      editHistoryContextMenu?: boolean
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export const editHistoryFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('editHistoryFeature', table, {
      table_undo: { fn: () => step(table, 'undo', 'api') },
      table_redo: { fn: () => step(table, 'redo', 'api') },
      table_canUndo: { fn: () => canUndo(table) },
      table_canRedo: { fn: () => canRedo(table) },
      table_rewindHistory: {
        fn: (entryId: string | null) => rewind(table, entryId, 'api'),
      },
      table_clearHistory: { fn: () => clearHistory(table) },
      table_getHistory: { fn: () => historyOf(table) },
      table_pushHistory: {
        fn: (entry: AppHistoryEntry) => pushHistory(table, entry),
      },
    })
  },
}
