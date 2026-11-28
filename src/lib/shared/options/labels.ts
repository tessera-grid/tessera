/** Подписи `options` (ADR 0182, §8): ключи словаря таблицы `options.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface OptionsLabels {
  /** Button that clears the quick search */
  clearSearch: string
}

export const optionsLabels = defineLabels<OptionsLabels>()(
  'options',
  {
    clearSearch: 'Clear search',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    options: typeof optionsLabels
  }
}
