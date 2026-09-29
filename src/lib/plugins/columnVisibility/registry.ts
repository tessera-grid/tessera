/**
 * Запись плагина columnVisibility на `definePlugin` (ADR 0035). Своей фичи нет:
 * видимость — стоковый срез `columnVisibility` ядра. Плагин добавляет кнопку
 * «Колонки» в тулбар (группа `view`), «Скрыть колонку» в кебаб заголовка и
 * бизнес-колбэк.
 */
import { definePlugin } from '../../core/definePlugin'
import { ColumnVisibilityButton } from './ColumnVisibilityButton'
import { hideHeaderAction } from './hideHeaderAction'
import type { ColumnVisibilityHooks } from './types'

export const COLUMN_VISIBILITY_TOOLBAR_GROUP = 'view'

export interface ColumnVisibilityOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк: пользователь показал или скрыл колонки из меню. */
  onToggleColumnVisibility?: ColumnVisibilityHooks['onToggleColumnVisibility']
}

export const columnVisibility = definePlugin<ColumnVisibilityOptions>()({
  id: 'columnVisibility',
  hooks: o => ({ onToggleColumnVisibility: o.onToggleColumnVisibility }),
  slotActions: [hideHeaderAction],
  slots: [
    {
      id: 'columnVisibilityButton',
      slot: 'toolbarSlot',
      group: COLUMN_VISIBILITY_TOOLBAR_GROUP,
      order: 0,
      component: ColumnVisibilityButton,
    },
  ],
})
