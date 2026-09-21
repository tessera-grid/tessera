/**
 * Плагин cellEditing (ADR 0028) — носитель ЛОКАЛЬНОГО состояния. `state` объявляет
 * дефолт слайса «редактируемая ячейка» (ключ `rowId:columnId` или null); definePlugin
 * генерирует v9-фичу, seed'ящую слайс под ключом `cellEditing`, а компонент читает/
 * пишет его пропсом `state` (`injectCellState`).
 *
 * Кнопка живёт в правом слоте ЛЮБОЙ не-сервисной колонки (в сервисных слоты не
 * рендерятся — BodyCell), появляется по hover и без hover места не занимает; показ
 * гейтит предикат `canEdit` из аргументов фабрики.
 */
import type { CellComponentProps } from '../../core/createSlots'
import { definePlugin, injectCellState } from '../../core/definePlugin'
import { CellEditControl } from './CellEditControl'
import type { CellEditingHooks, EditingCell } from './types'

export interface CellEditingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Условие показа кнопки редактирования по контексту ячейки (по умолчанию — всегда). */
  canEdit?: (ctx: CellComponentProps) => boolean
  /** Коммит нового значения ячейки (аргумент фабрики, ADR 0027); читается живо. */
  onCellEdit?: CellEditingHooks['onCellEdit']
}

export const cellEditing = definePlugin<CellEditingOptions>()({
  id: 'cellEditing',
  // Локальный слайс: какая ячейка сейчас редактируется.
  state: (): EditingCell => null,
  hooks: o => ({
    canEdit: o.canEdit ?? (() => true),
    onCellEdit: o.onCellEdit ?? (() => {}),
  }),
  slots: [
    {
      id: 'cellEditing',
      slot: 'rightCellSlot',
      order: 'last',
      component: injectCellState(CellEditControl, 'cellEditing'),
    },
  ],
})
