/** Подписи `contextMenu` (ADR 0182, §8): ключи словаря таблицы `contextMenu.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ContextMenuLabels {
  /** Accessible name of the context menu (`aria-label` on `role="menu"`) */
  contextMenu: string
  /** Cell menu item: retry a rejected save (ADR 0177, OB16). */
  retrySave: string
  /** Cell menu item: cancel a pending save (ADR 0177, OB16). */
  cancelSave: string
  /** Cell menu item on touch: a hint with the full truncated text (ADR 0231, §6). */
  showFullText: string
}

export const contextMenuLabels = defineLabels<ContextMenuLabels>()(
  'contextMenu',
  {
    contextMenu: 'Context menu',
    retrySave: 'Retry saving',
    cancelSave: 'Cancel saving',
    showFullText: 'Show full text',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    contextMenu: typeof contextMenuLabels
  }
}
