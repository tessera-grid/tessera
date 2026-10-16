/**
 * Запись плагина rowExpandingModel на `definePlugin`: модель дерева без интерфейса (ADR 0119).
 * Строки раскрыты по срезу `expanded` приложения; переключатель, предел глубины и
 * ленивые дети — у `rowExpanding`, который приносит ту же модель.
 */
import { rowExpandingFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import {
  createIncrementalExpandedRowModel,
  narrowExpandingOff,
} from '../../core/expandedRowModel'
import { neverInert } from '../../core/pluginDiagnostics'

export interface RowExpandingModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const rowExpandingModel = definePlugin<RowExpandingModelOptions>()({
  id: 'rowExpandingModel',
  diagnose: neverInert,
  features: {
    rowExpandingFeature,
    expandedRowModel: createIncrementalExpandedRowModel(),
  },
  narrow: () => ({ expanded: narrowExpandingOff }),
  options: o => ({
    enableExpanding: o.enabled !== false,
    autoResetExpanded: false,
  }),
})
