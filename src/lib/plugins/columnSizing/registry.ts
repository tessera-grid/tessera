/**
 * Запись плагина columnSizing (ADR 0013) на `definePlugin`. Sizing и resizing — две
 * отдельные фичи ядра; ресайз требует размеров, поэтому фичи несут обе:
 * `columnSizingFeature` + `columnResizingFeature` (prereq проверяется типами).
 */
import {
  columnResizingFeature,
  columnSizingFeature,
} from '@tanstack/react-table'

import { definePlugin, injectHeaderHooks } from '../../core/definePlugin'
import { ColumnSizingComponent } from './ColumnSizingComponent'
import type { ColumnSizingHooks } from './types'

export interface ColumnSizingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк окончания ресайза (аргумент фабрики, ADR 0027); читается живо. */
  onColumnResizeEnd?: ColumnSizingHooks['onColumnResizeEnd']
}

export const columnSizing = definePlugin<ColumnSizingOptions>()({
  id: 'columnSizing',
  features: { columnSizingFeature, columnResizingFeature },
  hooks: o => ({ onColumnResizeEnd: o.onColumnResizeEnd }),
  slots: [
    {
      id: 'columnSizingPlugin',
      slot: 'rightHeaderSlot',
      order: 'last',
      component: injectHeaderHooks(ColumnSizingComponent, 'columnSizing'),
      // Resize-грип — кромочный аффорданс, а не иконка-кнопка: инлайн, но НЕ
      // учитывается в пороге схлопывания кебаба (иначе «крал» бы место).
      countsAsHeaderAction: false,
    },
  ],
  options: o => ({
    enableColumnResizing: o.enabled !== false,
    columnResizeMode: 'onChange',
  }),
})
