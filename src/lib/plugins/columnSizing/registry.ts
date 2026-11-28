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
import { autosizeHeaderActions } from './autosizeHeaderActions'
import { columnAutosizeFeature } from './columnAutosizeFeature'
import { reconcileAutosizeOnData } from './autosizeOnData'
import type { ColumnSizingHooks } from './types'
import { columnSizingLabels } from './labels'

export interface ColumnSizingOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Business callback at the end of a resize (a factory argument); read live. */
  onColumnResizeEnd?: ColumnSizingHooks['onColumnResizeEnd']
  /** The resize was cancelled: Escape, disallowed on the fly, the column went away (ADR 0040). */
  onColumnResizeCancel?: ColumnSizingHooks['onColumnResizeCancel']
  /**
   * Fit columns to content when data arrives and on every new `data` reference, except columns
   * the user resized (ADR 0217, §2).
   */
  autosizeOnData?: boolean
}

export const columnSizing = definePlugin<ColumnSizingOptions>()({
  id: 'columnSizing',
  labels: [columnSizingLabels],
  actions: {
    resize: labels => columnSizingLabels(labels).resizeColumn,
    resetSize: labels => columnSizingLabels(labels).resetColumnWidth,
    resizeBy: labels => columnSizingLabels(labels).resizeColumn,
    resizeCancel: labels => columnSizingLabels(labels).actionResizeCancel,
    autosize: labels => columnSizingLabels(labels).autosizeColumn,
    autosizeAll: labels => columnSizingLabels(labels).autosizeAllColumns,
    handleMenu: labels => columnSizingLabels(labels).columnWidth,
  },
  diagnose: neverInert,
  features: {
    columnSizingFeature,
    columnResizingFeature,
    columnAutosizeFeature,
  },
  hooks: o => ({
    onColumnResizeEnd: o.onColumnResizeEnd ?? (() => null),
    onColumnResizeCancel: o.onColumnResizeCancel,
  }),
  slotActions: autosizeHeaderActions,
  reconcile: reconcileAutosizeOnData,
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
    autosizeOnData: o.autosizeOnData === true,
    columnResizeMode: 'onChange',
  }),
})
