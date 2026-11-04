/** Подписи `contextMenu` (ADR 0182, §8): ключи словаря таблицы `contextMenu.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ContextMenuLabels {
  /** Доступное имя контекстного меню (`aria-label` на `role="menu"`) */
  contextMenu: string
  /** Пункт меню ячейки: повторить отклонённое сохранение (ADR 0177, OB16). */
  retrySave: string
  /** Пункт меню ячейки: отменить ждущее сохранение (ADR 0177, OB16). */
  cancelSave: string
}

export const contextMenuLabels = defineLabels<ContextMenuLabels>()(
  'contextMenu',
  {
    contextMenu: 'Context menu',
    retrySave: 'Retry saving',
    cancelSave: 'Cancel saving',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    contextMenu: typeof contextMenuLabels
  }
}
