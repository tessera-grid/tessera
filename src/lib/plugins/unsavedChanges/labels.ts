/** Подписи `unsavedChanges` (ADR 0182, §8): ключи словаря таблицы `unsavedChanges.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface UnsavedChangesLabels {
  /** Unsaved-changes panel (ADR 0178, §8): the toolbar button and the popover title. */
  unsavedChanges: string
  /** Panel button with the number of drafts. */
  unsavedChangesButton: (count: number) => string
  /** Empty panel. */
  unsavedChangesEmpty: string
  unsavedChangesEmptyDescription: string
  /** Buttons of a panel entry. */
  draftShow: string
  draftApply: string
  draftDiscard: string
  /** Buttons at the bottom of the panel. */
  draftApplyAll: string
  draftDiscardAll: string
  /** Hint of an entry's dot (ADR 0224). */
  markHint: string
  /** Scrolling to the entry's target failed (ADR 0227, §7). */
  targetNotFound: string
}

export const unsavedChangesLabels = defineLabels<UnsavedChangesLabels>()(
  'unsavedChanges',
  {
    unsavedChanges: 'Unsaved changes',
    unsavedChangesButton: 'Unsaved changes: {count}',
    unsavedChangesEmpty: 'No unsaved changes',
    unsavedChangesEmptyDescription:
      'Changes you have not applied yet will appear here',
    draftShow: 'Show',
    draftApply: 'Apply',
    draftDiscard: 'Revert',
    draftApplyAll: 'Apply all',
    draftDiscardAll: 'Revert all',
    markHint: 'Not applied',
    targetNotFound: "Couldn't find the row",
  },
  {
    unsavedChangesButton: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    unsavedChanges: typeof unsavedChangesLabels
  }
}
