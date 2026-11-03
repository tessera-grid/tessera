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
import {
  editCellKeyboardAction,
  toggleCellKeyboardAction,
} from './keyboardActions'
import { EMPTY_EDITING_STATE, reconcileEditSession } from './session'
import type { CellComponentProps } from '../../core/createSlots'
import type { CellEditingHooks, CellEditingState } from './types'

export interface CellEditingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Условие показа кнопки редактирования по контексту ячейки (по умолчанию — всегда). */
  canEditCell?: (ctx: CellComponentProps) => boolean
  /** Коммит нового значения ячейки (аргумент фабрики); читается живо. */
  onCellEdit?: CellEditingHooks['onCellEdit']
  /** Правка завершилась без сохранения; приходят причина и черновик (ADR 0040). */
  onEditCancel?: CellEditingHooks['onEditCancel']
  /** `'manual'` — законченная правка становится черновиком, сохраняет пакет (ADR 0178, §5). */
  saveMode?: CellEditingHooks['saveMode']
  /** Сохранить пакет черновиков ячеек одним вызовом (ADR 0178, §5). */
  onCommitEdits?: CellEditingHooks['onCommitEdits']
  /** Значение изменилось извне во время правки: сохранить (по умолчанию) или нет. */
  onConflict?: CellEditingHooks['onConflict']
  /** Свой редактор ячеек; главнее — `editor` колонки и её типа, иначе встроенный по типу. */
  editor?: CellEditingHooks['editor']
  /** Пауза ввода перед запросом справочника `loadOptions` в редакторе, мс; без неё — на каждый ввод. */
  searchDebounceMs?: number
  /** Проверка значения в типе колонки перед коммитом: текст ошибки блокирует коммит. */
  validate?: CellEditingHooks['validate']
  /**
   * Состояние правки у приложения: открытая правка (`active`) и ячейки, ждущие сервера
   * (ADR 0028, CE6; ADR 0171, §4).
   */
  editing?: CellEditingState
  /** Состояние правки сменилось — открытие, ввод черновика, закрытие, ответ сервера. */
  onEditingChange?: (next: CellEditingState) => void
  /** Состояние правки при монтировании, если его не ведёт приложение (EF10). */
  initialEditing?: CellEditingState
}

export const cellEditing = definePlugin<CellEditingOptions>()({
  id: 'cellEditing',
  // Методы addRow и removeRow строк до сохранения (ADR 0178, §7).
  features: { rowDraftsFeature },
  // Новые строки показывает слой поверх источника строк, а не модель строк.
  options: () => ({ rowSourceLayer: rowDraftsLayer }),
  // Предикат влияет на отрисовку ячеек: новая ссылка — перерисовка (ADR 0039).
  refreshOn: ['canEditCell'],
  diagnose: neverInert,
  // Локальный слайс: активная правка и отправленные ячейки (ADR 0040, ADR 0041).
  state: (): CellEditingState => EMPTY_EDITING_STATE,
  stateName: 'editing',
  reconcile: reconcileEditSession,
  hooks: o => ({
    canEditCell: o.canEditCell ?? (() => true),
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
