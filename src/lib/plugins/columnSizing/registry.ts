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
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк окончания ресайза (аргумент фабрики); читается живо. */
  onColumnResizeEnd?: ColumnSizingHooks['onColumnResizeEnd']
  /** Ресайз отменён: Escape, запрет на лету, колонка ушла (ADR 0040). */
  onColumnResizeCancel?: ColumnSizingHooks['onColumnResizeCancel']
  /**
   * Подгонять колонки по содержимому на приходе данных и на каждой новой ссылке `data`,
   * кроме протянутых пользователем (ADR 0217, §2).
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
