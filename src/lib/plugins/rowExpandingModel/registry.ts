/**
 * Запись плагина rowExpandingModel на `definePlugin`: модель дерева без интерфейса
 * (ADR 0119, ADR 0120). Строки раскрыты по срезу `expanded`; переключатель, предел
 * глубины и ленивые дети — у `rowExpanding`, который включает эту модель.
 */
import { type ExpandedState, rowExpandingFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import {
  createIncrementalExpandedRowModel,
  narrowExpandingOff,
} from '../../shared/rowModels/expandedRowModel'
import { neverInert } from '../../core/pluginDiagnostics'
import { ownStage } from '../../core/rowEngine/engine'

export interface RowExpandingModelOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Expanded rows (`true` — all) set by the application; without it the grid keeps the slice. */
  expanded?: ExpandedState
  /** New slice value after each change from inside the grid. */
  onExpandedChange?: (next: ExpandedState) => void
  /** Initial value of the slice the grid owns. */
  initialExpanded?: ExpandedState
}

export const rowExpandingModel = definePlugin<RowExpandingModelOptions>()({
  id: 'rowExpandingModel',
  diagnose: neverInert,
  features: {
    rowExpandingFeature,
    expandedRowModel: ownStage('expand', createIncrementalExpandedRowModel()),
  },
  slices: ['expanded'],
  narrow: () => ({ expanded: narrowExpandingOff }),
  options: o => ({
    enableExpanding: o.enabled !== false,
    // Строки — дерево: факт ядра (ADR 0168, §4).
    treeRows: o.enabled !== false,
    autoResetExpanded: false,
  }),
})
