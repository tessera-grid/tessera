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
import { EMPTY_SLICE, ID, recordWritten } from './history'
import { HistoryButton, UndoRedoButtons } from './HistoryButtons'
import { editHistoryKeys } from './keys'
import { editHistoryLabels } from './labels'

/** Группа тулбара: перед пультом черновиков и журналом отказов (`core/toolbar`). */
export const EDIT_HISTORY_TOOLBAR_GROUP = 'history'

export interface EditHistoryOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Предел записей; старейшая уходит. По умолчанию 30. */
  limit?: number
  /** Ячейка изменилась извне после записи: пропустить (по умолчанию) или писать поверх. */
  conflict?: 'skip' | 'overwrite'
  /** Кнопки «Отменить» и «Повторить» в тулбаре; `false` — без них. */
  toolbar?: ToolbarPlacement | false
  /** Пункты «Отменить» и «Повторить» в контекстном меню ячейки. По умолчанию `true`. */
  contextMenu?: boolean
  /** Кнопка «История» в тулбаре; `false` — без неё. */
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
    editHistoryLimit: o.limit ?? 30,
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
  EditHistoryEntry,
  EditHistoryState,
} from './history'
