/** Подписи `backToTop` (ADR 0182, §8): ключи словаря таблицы `backToTop.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface BackToTopLabels {
  /** Кнопка «наверх» в нижней панели (ADR 0082): тултип и доступное имя */
  backToTop: string
  /** Кнопка «к первой колонке» в нижней панели (ADR 0105) */
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
