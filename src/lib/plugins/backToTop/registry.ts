/**
 * Запись плагина backToTop на `definePlugin` (ADR 0082, ADR 0105): кнопки «к первой
 * колонке» и «наверх» справа в нижней панели, перед пагинацией. Панель сами не вызывают
 * (`showsPanel: false`).
 */
import { definePlugin } from '../../core/definePlugin'
import { BackToStartButton, BackToTopButton } from './BackToTopButton'
import { BACK_TO_TOP, backToTopInertReason } from './model'

export interface BackToTopOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** С какой прокрутки тела (px) видна кнопка; по умолчанию — две высоты тела. */
  threshold?: number
  /** С какой горизонтальной прокрутки (px) видна «к первой колонке»; по умолчанию — две ширины тела. */
  horizontalThreshold?: number
  /** Какие кнопки показывать; по умолчанию обе. */
  axes?: 'vertical' | 'horizontal' | 'both'
}

export const backToTop = definePlugin<BackToTopOptions>()({
  id: BACK_TO_TOP,
  diagnose: backToTopInertReason,
  options: o => ({
    backToTopThreshold: o.enabled === false ? undefined : o.threshold,
    backToTopHorizontalThreshold:
      o.enabled === false ? undefined : o.horizontalThreshold,
    backToTopAxes: o.axes,
  }),
  slots: [
    {
      id: 'backToStart',
      slot: 'statusBarSlot',
      align: 'end',
      order: -1,
      showsPanel: false,
      component: BackToStartButton,
    },
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
