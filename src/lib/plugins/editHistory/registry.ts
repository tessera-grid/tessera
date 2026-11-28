/**
 * Плагин editHistory (ADR 0222) — отмена и повтор правок: записи — сохранённые операции записи
 * в ячейки и записи приложения; отмена — компенсирующая запись тем же каналом. Клавиши — вклад в
 * канал клавиш навигации; кнопки «Отменить», «Повторить» и «История» — в тулбаре, пункты — в
 * контекстном меню ячейки.
 */
import { withBody } from '../../core/bodyContributions'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import {
  placeToolbarSlot,
  type ToolbarPlacement,
} from '../../shared/toolbarPlacement'
import { redoContextAction, undoContextAction } from './contextActions'
import { editHistoryFeature } from './editHistoryFeature'
import { EMPTY_SLICE, ID, recordWritten, DEFAULT_MAX_CELLS } from './history'
import type { EditHistoryChange, EditHistorySource } from './history'
import { HistoryButton, UndoRedoButtons } from './HistoryButtons'
import { editHistoryKeys } from './keys'
import { editHistoryLabels } from './labels'

/** Группа тулбара: перед пультом черновиков и журналом отказов (`core/toolbar`). */
export const EDIT_HISTORY_TOOLBAR_GROUP = 'history'

export interface EditHistoryOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /**
   * Change kinds recorded in the history (ADR 0222, §16): `'edit'`, `'paste'`, `'row'`, `'app'`…;
   * unset means all. What isn't recorded can't be undone.
   */
  sources?: readonly EditHistorySource[]
  /** Whether a change is recorded (§16): together with `sources` — recorded if both agree. */
  canRecordChange?: (change: EditHistoryChange) => boolean
  /** Entry limit; the oldest one goes away. 30 by default. */
  limit?: number
  /** Cells across all entries; the oldest go away. 50,000 by default (ADR 0223). */
  maxCells?: number
  /** The cell changed from outside after the entry: skip it (default) or write over it. */
  conflict?: 'skip' | 'overwrite'
  /** "Undo" and "Redo" buttons in the toolbar; `false` — none. */
  toolbar?: ToolbarPlacement | false
  /** "Undo" and "Redo" items in the cell context menu. `true` by default. */
  contextMenu?: boolean
  /** The "History" button in the toolbar; `false` — none. */
  historyPanel?: ToolbarPlacement | false
}

const editHistoryEntry = definePlugin<EditHistoryOptions>()({
  id: ID,
  features: { editHistoryFeature },
  labels: [editHistoryLabels],
  actions: {
    undo: (labels, params) =>
      typeof params?.name === 'string'
        ? editHistoryLabels(labels).undoEntry(params.name)
        : editHistoryLabels(labels).undo,
    redo: (labels, params) =>
      typeof params?.name === 'string'
        ? editHistoryLabels(labels).redoEntry(params.name)
        : editHistoryLabels(labels).redo,
    rewind: labels => editHistoryLabels(labels).rewind,
  },
  diagnose: neverInert,
  state: () => EMPTY_SLICE,
  options: o => ({
    cellsWritten: recordWritten,
    editHistorySources: o.sources,
    editHistoryCanRecordChange: o.canRecordChange,
    editHistoryLimit: o.limit ?? 30,
    editHistoryMaxCells: o.maxCells ?? DEFAULT_MAX_CELLS,
    editHistoryConflict: o.conflict ?? 'skip',
    editHistoryContextMenu: o.contextMenu !== false,
  }),
  contextMenuActions: [undoContextAction, redoContextAction],
  slots: o => [
    ...placeToolbarSlot(
      {
        id: 'editHistoryButtons',
        slot: 'toolbarSlot',
        group: EDIT_HISTORY_TOOLBAR_GROUP,
        order: 0,
        showsPanel: false,
        component: UndoRedoButtons,
      },
      o.toolbar,
    ),
    ...placeToolbarSlot(
      {
        id: 'editHistoryPanel',
        slot: 'toolbarSlot',
        group: EDIT_HISTORY_TOOLBAR_GROUP,
        order: 1,
        showsPanel: false,
        component: HistoryButton,
      },
      o.historyPanel,
    ),
  ],
})

export const editHistory = withBody(editHistoryEntry, { keys: editHistoryKeys })

export type {
  AppHistoryEntry,
  EditHistoryChange,
  EditHistorySource,
  EditHistoryEntry,
  EditHistoryState,
} from './history'
