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
import { stageSlot } from '../../core/rowEngine/engine'

export interface RowExpandingModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Раскрытые строки (`true` — все): задаёт приложение; без него срез хранит грид. */
  expanded?: ExpandedState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onExpandedChange?: (next: ExpandedState) => void
  /** Начальное значение среза, которым владеет грид. */
  initialExpanded?: ExpandedState
}

export const rowExpandingModel = definePlugin<RowExpandingModelOptions>()({
  id: 'rowExpandingModel',
  diagnose: neverInert,
  features: {
    rowExpandingFeature,
    expandedRowModel: stageSlot('expand', createIncrementalExpandedRowModel()),
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
