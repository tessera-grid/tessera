/**
 * Плагин cellEditing — носитель ЛОКАЛЬНОГО состояния. `state` объявляет
 * дефолт слайса: активная сессия правки и ячейки, ждущие сервера (ADR 0041);
 * definePlugin генерирует v9-фичу, seed'ящую слайс под ключом `plugin:cellEditing`.
 * Сессию с таблицей согласует `reconcile` (ADR 0040, §2).
 *
 * Два слота одного плагина, оба подписаны на «редактируется ли эта ячейка»:
 *  - `rightCellSlot` — кнопка входа в правку (по hover, места без hover не занимает),
 *    в ЛЮБОЙ не-сервисной колонке (в сервисных слоты не рендерятся — BodyCell);
 *  - `cellSlot` — владелец контента: в режиме правки ЗАМЕЩАЕТ собственный рендер
 *    ячейки редактором (ядровый seam RenderCellSlot), иначе отдаёт контент как есть.
 *
 * Показ кнопки гейтит предикат `canEditCell`; редактор — BYO через `editor` (дефолт —
 * встроенный CellEditInput). И предикат, и редактор живут в hook-слайсе (читаются живо).
 */
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { CellEditButton } from './CellEditButton'
import { CellEditField } from './CellEditField'
import { CellDraftMark } from './CellDraftMark'
import { cellValueDraftKind, rowDeleteKind, rowInsertKind } from './cellDrafts'
import { rowDraftAction } from './rowDraftActions'
import { rowDraftsLayer } from './rowDrafts'
import { rowDraftsFeature } from './rowDraftsFeature'
import { cellWriter } from './writeCells'
import {
  editCellKeyboardAction,
  toggleCellKeyboardAction,
} from './keyboardActions'
import {
  DEFAULT_CAN_EDIT_CELL,
  EMPTY_EDITING_STATE,
  reconcileEditSession,
} from './session'
import type { CellComponentProps } from '../../core/createSlots'
import type { CellEditingHooks, CellEditingState } from './types'
import { cellEditingLabels } from './labels'
import { calendarLabels } from '../../shared/calendar/labels'
import { optionsLabels } from '../../shared/options/labels'

export interface CellEditingOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Whether to show the edit button for a cell context (always by default). */
  canEditCell?: (ctx: CellComponentProps) => boolean
  /** Commits a new cell value (a factory argument); read live. */
  onCellEdit?: CellEditingHooks['onCellEdit']
  /** The edit ended without saving; receives the reason and the draft (ADR 0040). */
  onEditCancel?: CellEditingHooks['onEditCancel']
  /** `'manual'` — a finished edit becomes a draft, saved by a batch (ADR 0178, §5). */
  saveMode?: CellEditingHooks['saveMode']
  /** Saves a batch of cell drafts in one call (ADR 0178, §5). */
  onCommitEdits?: CellEditingHooks['onCommitEdits']
  /** The value changed from outside during the edit: save it (default) or not. */
  onConflict?: CellEditingHooks['onConflict']
  /** Custom cell editor; the column's and its type's `editor` take precedence, otherwise the built-in one for the type. */
  editor?: CellEditingHooks['editor']
  /** Typing pause before the `loadOptions` lookup request in the editor, ms; without it — on every keystroke. */
  searchDebounceMs?: number
  /** Validates the value in the column type before committing: an error text blocks the commit. */
  validate?: CellEditingHooks['validate']
  /**
   * Edit state controlled by the application: the open edit (`active`) and cells waiting for
   * the server (ADR 0028, CE6; ADR 0171, §4).
   */
  editing?: CellEditingState
  /** The edit state changed — open, draft input, close, server answer. */
  onEditingChange?: (next: CellEditingState) => void
  /** Edit state at mount, when the application doesn't control it (EF10). */
  initialEditing?: CellEditingState
}

export const cellEditing = definePlugin<CellEditingOptions>()({
  id: 'cellEditing',
  labels: [cellEditingLabels, calendarLabels, optionsLabels],
  actions: {
    edit: labels => cellEditingLabels(labels).cellDraftKind,
    commit: { plugin: 'core', action: 'save' },
    // Итог применения черновиков (ADR 0227, AO18).
    applied: { plugin: 'core', action: 'save' },
    changeDraft: labels => cellEditingLabels(labels).actionChangeDraft,
    validationFailed: labels =>
      cellEditingLabels(labels).actionValidationFailed,
    'cellEditing.start': labels => cellEditingLabels(labels).editCell,
    'cellEditing.toggle': labels => cellEditingLabels(labels).actionToggle,
    rowInsert: labels => cellEditingLabels(labels).rowInsertDraftKind,
    rowDelete: labels => cellEditingLabels(labels).rowDeleteDraftKind,
    rowInsertDiscard: labels => cellEditingLabels(labels).rowInsertDiscard,
    rowDeleteDiscard: labels => cellEditingLabels(labels).rowDeleteDiscard,
    cellDraftRollback: labels => cellEditingLabels(labels).cellDraftRollback,
    rowDraftDiscard: labels => cellEditingLabels(labels).actionRowDraftDiscard,
    paste: labels => cellEditingLabels(labels).actionPaste,
    cut: labels => cellEditingLabels(labels).actionCut,
    clear: labels => cellEditingLabels(labels).actionClear,
    bulkEdit: labels => cellEditingLabels(labels).actionBulkEdit,
    fillDown: labels => cellEditingLabels(labels).actionFillDown,
    fillRight: labels => cellEditingLabels(labels).actionFillRight,
    write: labels => cellEditingLabels(labels).actionWrite,
  },
  // Методы addRow и removeRow строк до сохранения (ADR 0178, §7).
  features: { rowDraftsFeature },
  // Новые строки показывает слой поверх источника строк, а не модель строк.
  // Запись в ячейки — вставка, очистка, массовая правка (ADR 0219, §1).
  options: o => ({
    rowSourceLayer: rowDraftsLayer,
    ...(o.enabled === false ? {} : { cellWriter }),
  }),
  // Предикат влияет на отрисовку ячеек: новая ссылка — перерисовка (ADR 0039).
  refreshOn: ['canEditCell'],
  diagnose: neverInert,
  // Локальный слайс: активная правка и отправленные ячейки (ADR 0040, ADR 0041).
  state: (): CellEditingState => EMPTY_EDITING_STATE,
  stateName: 'editing',
  reconcile: reconcileEditSession,
  hooks: o => ({
    canEditCell: o.canEditCell ?? DEFAULT_CAN_EDIT_CELL,
    onCellEdit: o.onCellEdit ?? (() => {}),
    onEditCancel: o.onEditCancel,
    saveMode: o.saveMode,
    onCommitEdits: o.onCommitEdits,
    onConflict: o.onConflict,
    editor: o.editor,
    validate: o.validate,
    searchDebounceMs: o.searchDebounceMs,
  }),
  keyboardActions: [editCellKeyboardAction, toggleCellKeyboardAction],
  // Значение ячейки до сохранения по кнопке (ADR 0178, §5).
  // Строки до сохранения — тем же пакетом (ADR 0178, §7).
  draftKinds: [cellValueDraftKind, rowInsertKind, rowDeleteKind],
  slotActions: [rowDraftAction],
  slots: [
    {
      id: 'cellEditing',
      slot: 'rightCellSlot',
      order: 'last',
      component: CellEditButton,
    },
    {
      id: 'cellEditingDraft',
      slot: 'rightCellSlot',
      order: 'last',
      component: CellDraftMark,
    },
    {
      id: 'cellEditing',
      slot: 'cellSlot',
      // `content` кладёт RenderCellSlot — собственный рендер ячейки.
      component: CellEditField,
    },
  ],
})
