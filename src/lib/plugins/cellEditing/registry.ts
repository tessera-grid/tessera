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
 * Показ кнопки гейтит предикат `canEdit`; редактор — BYO через `editor` (дефолт —
 * встроенный CellEditInput). И предикат, и редактор живут в hook-слайсе (читаются живо).
 */
import { createElement, type ReactNode } from 'react'

import {
  definePlugin,
  injectCellHooks,
  readPluginHooks,
} from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { CellEditButton } from './CellEditButton'
import { CellEditField } from './CellEditField'
import { editCellKeyboardAction } from './keyboardActions'
import { EMPTY_EDITING_STATE, reconcileEditSession } from './session'
import type { CellComponentProps } from '../../core/createSlots'
import type { CellEditingHooks, CellEditingState } from './types'

export interface CellEditingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Условие показа кнопки редактирования по контексту ячейки (по умолчанию — всегда). */
  canEdit?: (ctx: CellComponentProps) => boolean
  /** Коммит нового значения ячейки (аргумент фабрики); читается живо. */
  onCellEdit?: CellEditingHooks['onCellEdit']
  /** Правка завершилась без сохранения; приходят причина и черновик (ADR 0040). */
  onEditCancel?: CellEditingHooks['onEditCancel']
  /** Значение изменилось извне во время правки: сохранить (по умолчанию) или нет. */
  onConflict?: CellEditingHooks['onConflict']
  /** Свой редактор ячейки (BYO); не задан — встроенный инлайн-ввод. */
  editor?: CellEditingHooks['editor']
  /** Проверка значения перед коммитом: текст ошибки блокирует коммит. */
  validate?: CellEditingHooks['validate']
}

export const cellEditing = definePlugin<CellEditingOptions>()({
  id: 'cellEditing',
  // Предикат влияет на отрисовку ячеек: новая ссылка — перерисовка (ADR 0039).
  refreshOn: ['canEdit'],
  diagnose: neverInert,
  // Локальный слайс: активная правка и отправленные ячейки (ADR 0040, ADR 0041).
  state: (): CellEditingState => EMPTY_EDITING_STATE,
  reconcile: reconcileEditSession,
  hooks: o => ({
    canEdit: o.canEdit ?? (() => true),
    onCellEdit: o.onCellEdit ?? (() => {}),
    onEditCancel: o.onEditCancel,
    onConflict: o.onConflict,
    editor: o.editor,
    validate: o.validate,
  }),
  keyboardActions: [editCellKeyboardAction],
  slots: [
    {
      id: 'cellEditing',
      slot: 'rightCellSlot',
      order: 'last',
      component: injectCellHooks(CellEditButton, 'cellEditing'),
    },
    {
      id: 'cellEditing',
      slot: 'cellSlot',
      // `content` кладёт RenderCellSlot — собственный рендер ячейки.
      component: (ctx: CellComponentProps) =>
        createElement(CellEditField, {
          ...ctx,
          content: (ctx as { content?: ReactNode }).content,
          hooks: readPluginHooks<CellEditingHooks>(ctx.table, 'cellEditing'),
        }),
    },
  ],
})
