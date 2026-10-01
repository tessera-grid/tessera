/**
 * Запись плагина columnSizing на `definePlugin`. Sizing и resizing — две
 * отдельные фичи ядра; ресайз требует размеров, поэтому фичи несут обе:
 * `columnSizingFeature` + `columnResizingFeature` (prereq проверяется типами).
 */
import {
  columnResizingFeature,
  columnSizingFeature,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { ColumnSizingComponent } from './ColumnSizingComponent'
import type { ColumnSizingHooks } from './types'

export interface ColumnSizingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк окончания ресайза (аргумент фабрики); читается живо. */
  onColumnResizeEnd?: ColumnSizingHooks['onColumnResizeEnd']
  /** Ресайз отменён: Escape, запрет на лету, колонка ушла (ADR 0040). */
  onColumnResizeCancel?: ColumnSizingHooks['onColumnResizeCancel']
}

export const columnSizing = definePlugin<ColumnSizingOptions>()({
  id: 'columnSizing',
  diagnose: neverInert,
  features: { columnSizingFeature, columnResizingFeature },
  hooks: o => ({
    onColumnResizeEnd: o.onColumnResizeEnd ?? (() => null),
    onColumnResizeCancel: o.onColumnResizeCancel,
  }),
  slots: [
    {
      id: 'columnSizingPlugin',
      slot: 'rightHeaderSlot',
      order: 'last',
      component: ColumnSizingComponent,
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
