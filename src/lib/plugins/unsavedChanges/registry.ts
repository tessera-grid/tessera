/**
 * Плагин пульта черновиков (ADR 0178, §8): кнопка тулбара со счётчиком черновиков; поповер —
 * список черновиков с переходом к цели, применением и отбрасыванием, внизу «Применить всё» и
 * «Отменить всё». Тулбар кнопка не вызывает: она встаёт в тулбар, который у таблицы уже есть.
 */
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { UnsavedChangesButton } from './UnsavedChangesButton'

/** Группа тулбара: перед журналом отказов, после групп потребителя (ранг — `core/toolbar`). */
export const UNSAVED_CHANGES_TOOLBAR_GROUP = 'drafts'

export interface UnsavedChangesOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const unsavedChanges = definePlugin<UnsavedChangesOptions>()({
  id: 'unsavedChanges',
  diagnose: neverInert,
  slots: [
    {
      id: 'unsavedChangesButton',
      slot: 'toolbarSlot',
      group: UNSAVED_CHANGES_TOOLBAR_GROUP,
      order: 0,
      showsPanel: false,
      component: UnsavedChangesButton,
    },
  ],
})
