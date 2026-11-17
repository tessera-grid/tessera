/** Подписи `unsavedChanges` (ADR 0182, §8): ключи словаря таблицы `unsavedChanges.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface UnsavedChangesLabels {
  /** Пульт черновиков (ADR 0178, §8): кнопка тулбара и заголовок поповера. */
  unsavedChanges: string
  /** Кнопка пульта с числом черновиков. */
  unsavedChangesButton: (count: number) => string
  /** Пустой пульт. */
  unsavedChangesEmpty: string
  unsavedChangesEmptyDescription: string
  /** Кнопки записи пульта. */
  draftShow: string
  draftApply: string
  draftDiscard: string
  /** Кнопки внизу пульта. */
  draftApplyAll: string
  draftDiscardAll: string
  /** Подсказка точки записи (ADR 0224). */
  markHint: string
  /** Прокрутка к цели записи не удалась (ADR 0227, §7). */
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
