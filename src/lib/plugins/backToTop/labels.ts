/** Подписи `backToTop` (ADR 0182, §8): ключи словаря таблицы `backToTop.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface BackToTopLabels {
  /** "Back to top" button in the status bar (ADR 0082): tooltip and accessible name */
  backToTop: string
  /** "To first column" button in the status bar (ADR 0105) */
  backToStart: string
}

export const backToTopLabels = defineLabels<BackToTopLabels>()(
  'backToTop',
  {
    backToTop: 'Back to top',
    backToStart: 'Back to first column',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    backToTop: typeof backToTopLabels
  }
}
