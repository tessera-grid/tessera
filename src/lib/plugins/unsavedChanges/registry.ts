/**
 * Плагин пульта черновиков (ADR 0178, §8): кнопка тулбара со счётчиком черновиков; поповер —
 * список черновиков с переходом к цели, применением и сбрасыванием, внизу «Применить всё» и
 * «Сбросить всё». Тулбар кнопка не вызывает: она встаёт в тулбар, который у таблицы уже есть.
 */
import {
  placeToolbarSlot,
  type ToolbarPlacementOption,
} from '../../shared/toolbarPlacement'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { UnsavedChangesButton } from './UnsavedChangesButton'
import { unsavedChangesLabels } from './labels'

/** Группа тулбара: перед журналом отказов, после групп потребителя (ранг — `core/toolbar`). */
export const UNSAVED_CHANGES_TOOLBAR_GROUP = 'drafts'

export interface UnsavedChangesOptions extends ToolbarPlacementOption {
  /** `false` disables the plugin. */
  enabled?: boolean
}

export const unsavedChanges = definePlugin<UnsavedChangesOptions>()({
  id: 'unsavedChanges',
  labels: [unsavedChangesLabels],
  actions: {
    apply: labels => unsavedChangesLabels(labels).draftApply,
    applyAll: labels => unsavedChangesLabels(labels).draftApplyAll,
    discard: labels => unsavedChangesLabels(labels).draftDiscard,
    discardAll: labels => unsavedChangesLabels(labels).draftDiscardAll,
    show: labels => unsavedChangesLabels(labels).draftShow,
  },
  diagnose: neverInert,
  slots: o =>
    placeToolbarSlot(
      {
        id: 'unsavedChangesButton',
        slot: 'toolbarSlot',
        group: UNSAVED_CHANGES_TOOLBAR_GROUP,
        order: 0,
        showsPanel: false,
        component: UnsavedChangesButton,
      },
      o.toolbar,
    ),
})
