/**
 * Плагин cellEditing — носитель ЛОКАЛЬНОГО состояния. `state` объявляет
 * дефолт слайса «редактируемая ячейка» (ключ `rowId:columnId` или null); definePlugin
 * генерирует v9-фичу, seed'ящую слайс под ключом `cellEditing`.
 *
 * Два слота одного плагина, оба читают/пишут этот слайс:
 *  - `rightCellSlot` — кнопка входа в правку (по hover, места без hover не занимает),
 *    в ЛЮБОЙ не-сервисной колонке (в сервисных слоты не рендерятся — BodyCell);
 *  - `cellSlot` — владелец контента: в режиме правки ЗАМЕЩАЕТ собственный рендер
 *    ячейки редактором (ядровый seam RenderCellSlot), иначе отдаёт контент как есть.
 *
 * Показ кнопки гейтит предикат `canEdit`; редактор — BYO через `editor` (дефолт —
 * встроенный CellEditInput). И предикат, и редактор живут в hook-слайсе (читаются живо).
 */
import {
  definePlugin,
  injectCellOwner,
  injectCellState,
} from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { CellEditButton } from './CellEditButton'
import { CellEditField } from './CellEditField'
import { editCellKeyboardAction } from './keyboardActions'
import type { CellComponentProps } from '../../core/createSlots'
import type { CellEditingHooks, EditingCell } from './types'

export interface CellEditingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Условие показа кнопки редактирования по контексту ячейки (по умолчанию — всегда). */
  canEdit?: (ctx: CellComponentProps) => boolean
  /** Коммит нового значения ячейки (аргумент фабрики); читается живо. */
  onCellEdit?: CellEditingHooks['onCellEdit']
  /** Свой редактор ячейки (BYO); не задан — встроенный инлайн-ввод. */
  editor?: CellEditingHooks['editor']
  /** Проверка значения перед коммитом: текст ошибки блокирует коммит. */
  validate?: CellEditingHooks['validate']
}

export const cellEditing = definePlugin<CellEditingOptions>()({
  id: 'cellEditing',
  diagnose: neverInert,
  // Локальный слайс: какая ячейка сейчас редактируется.
  state: (): EditingCell => null,
  hooks: o => ({
    canEdit: o.canEdit ?? (() => true),
    onCellEdit: o.onCellEdit ?? (() => {}),
    editor: o.editor,
    validate: o.validate,
  }),
  keyboardActions: [editCellKeyboardAction],
  slots: [
    {
      id: 'cellEditing',
      slot: 'rightCellSlot',
      order: 'last',
      component: injectCellState(CellEditButton, 'cellEditing'),
    },
    {
      id: 'cellEditing',
      slot: 'cellSlot',
      component: injectCellOwner(CellEditField, 'cellEditing'),
    },
  ],
})
