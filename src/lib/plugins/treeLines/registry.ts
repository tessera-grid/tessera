/**
 * Запись плагина treeLines на `definePlugin`: линии дерева ADR 0102 у видимой иерархии —
 * дерева `rowExpandingModel`/`rowExpanding` и групп `rowGrouping` (ADR 0119). Сам ничего не
 * раскрывает.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'

export interface TreeLinesOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const treeLines = definePlugin<TreeLinesOptions>()({
  id: 'treeLines',
  // В серверной модели линии — по раскладке дерева (ADR 0161).
  diagnose: neverInert,
  options: o => ({ enableTreeLines: o.enabled !== false }),
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    treeLinesPlugin: {
      enableTreeLines?: boolean
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
