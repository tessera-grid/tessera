/**
 * Запись плагина backToTop на `definePlugin` (ADR 0082, ADR 0105): кнопки «к первой
 * колонке» и «наверх» справа в нижней панели, перед пагинацией. Панель сами не вызывают
 * (`showsPanel: false`).
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin } from '../../core/definePlugin'
import { BackToStartButton, BackToTopButton } from './BackToTopButton'
import { BACK_TO_TOP, backToTopInertReason } from './model'
import { backToTopLabels } from './labels'

export interface BackToTopOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Body scroll (px) from which the button is shown; two body heights by default. */
  threshold?: number
  /** Horizontal scroll (px) from which "to first column" is shown; two body widths by default. */
  horizontalThreshold?: number
  /** Which buttons to show; both by default. */
  axes?: 'vertical' | 'horizontal' | 'both'
}

export const backToTop = definePlugin<BackToTopOptions>()({
  id: BACK_TO_TOP,
  labels: [backToTopLabels],
  actions: {
    scrollToTop: labels => backToTopLabels(labels).backToTop,
    scrollToStart: labels => backToTopLabels(labels).backToStart,
  },
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

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    backToTopPlugin: {
      backToTopThreshold?: number
      backToTopHorizontalThreshold?: number
      backToTopAxes?: BackToTopOptions['axes']
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
