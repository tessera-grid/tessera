/**
 * Запись плагина backToTop на `definePlugin` (ADR 0082): кнопка «наверх» справа в
 * нижней панели, перед пагинацией. Панель сама не вызывает (`showsPanel: false`).
 */
import { definePlugin } from '../../core/definePlugin'
import { BackToTopButton } from './BackToTopButton'
import { BACK_TO_TOP, backToTopInertReason } from './model'

export interface BackToTopOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** С какой прокрутки тела (px) видна кнопка; по умолчанию — две высоты тела. */
  threshold?: number
}

export const backToTop = definePlugin<BackToTopOptions>()({
  id: BACK_TO_TOP,
  diagnose: backToTopInertReason,
  options: o => ({
    backToTopThreshold: o.enabled === false ? undefined : o.threshold,
  }),
  slots: [
    {
      id: 'backToTop',
      slot: 'statusBarSlot',
      align: 'end',
      order: 0,
      showsPanel: false,
      component: BackToTopButton,
    },
  ],
})
